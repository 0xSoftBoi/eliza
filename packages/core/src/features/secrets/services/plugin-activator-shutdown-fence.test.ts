/**
 * Deterministic shutdown-fencing coverage for PluginActivatorService.
 *
 * Once stop() is requested, suspended polling and secret-change handlers must
 * not start additional secret lookups, activate more plugins, or dispatch
 * secret-change callbacks into the draining service.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createMockRuntime,
	MOCK_AGENT_ID,
} from "../../../testing/mock-runtime.ts";
import type { IAgentRuntime } from "../../../types/index.ts";
import type { SecretChangeCallback, SecretContext } from "../types.ts";
import {
	PluginActivatorService,
	type PluginWithSecrets,
} from "./plugin-activator.ts";
import type { SecretsService } from "./secrets.ts";

const GLOBAL_CONTEXT: SecretContext = {
	level: "global",
	agentId: MOCK_AGENT_ID,
	requesterId: MOCK_AGENT_ID,
};

function makePlugin(
	name: string,
	onSecretChanged?: PluginWithSecrets["onSecretChanged"],
): PluginWithSecrets {
	const plugin: PluginWithSecrets = {
		name,
		description: `Exercises shutdown fencing for ${name}.`,
		requiredSecrets: {
			TOKEN: {
				description: "Test token",
				type: "token",
				required: true,
			},
		},
	};
	if (onSecretChanged) {
		plugin.onSecretChanged = onSecretChanged;
	}
	return plugin;
}

interface ActivatorHarness {
	emitSecretChange: () => Promise<void>;
	service: PluginActivatorService;
}

async function createHarness(
	getMissingSecrets: (keys: string[]) => Promise<string[]>,
	pollingIntervalMs = 1,
): Promise<ActivatorHarness> {
	let secretChangeCallback: SecretChangeCallback | undefined;
	const secretsService = {
		checkPluginRequirements: vi.fn(async () => ({
			ready: false,
			missingRequired: ["TOKEN"],
			missingOptional: [],
			invalid: [],
		})),
		getMissingSecrets: vi.fn(getMissingSecrets),
		onAnySecretChanged: vi.fn((callback: SecretChangeCallback) => {
			secretChangeCallback = callback;
			return () => undefined;
		}),
	} satisfies Pick<
		SecretsService,
		"checkPluginRequirements" | "getMissingSecrets" | "onAnySecretChanged"
	>;
	const runtime = createMockRuntime({
		getService: (() =>
			secretsService as SecretsService) as IAgentRuntime["getService"],
		reportError: vi.fn(),
	});
	const service = await PluginActivatorService.start(runtime, {
		enableAutoActivation: true,
		pollingIntervalMs,
	});

	return {
		service,
		emitSecretChange: async () => {
			if (!secretChangeCallback) {
				throw new Error("Secret-change callback was not registered");
			}
			await secretChangeCallback("TOKEN", "ready", GLOBAL_CONTEXT);
		},
	};
}

describe("PluginActivatorService shutdown fencing", () => {
	let activeService: PluginActivatorService | undefined;

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(async () => {
		await activeService?.stop();
		activeService = undefined;
		vi.useRealTimers();
	});

	it("does not start another poll lookup after stop() is requested", async () => {
		let releaseLookup: ((missing: string[]) => void) | undefined;
		const gate = new Promise<string[]>((resolve) => {
			releaseLookup = resolve;
		});
		let lookupCalls = 0;
		const harness = await createHarness(async () => {
			lookupCalls += 1;
			return gate;
		});
		activeService = harness.service;

		await harness.service.registerPlugin(makePlugin("plugin-a"));
		await harness.service.registerPlugin(makePlugin("plugin-b"));

		// The first poll suspends on plugin-a. If the loop merely continues after
		// shutdown, it will incorrectly start a second lookup for plugin-b.
		await vi.advanceTimersByTimeAsync(1);
		expect(lookupCalls).toBe(1);

		const stopping = harness.service.stop();
		releaseLookup?.(["TOKEN"]);
		await stopping;
		await vi.advanceTimersByTimeAsync(0);

		expect(lookupCalls).toBe(1);
	});

	it("does not start another secret-change lookup after stop() is requested", async () => {
		let releaseLookup: ((missing: string[]) => void) | undefined;
		const gate = new Promise<string[]>((resolve) => {
			releaseLookup = resolve;
		});
		let lookupCalls = 0;
		const harness = await createHarness(async () => {
			lookupCalls += 1;
			return gate;
		}, 1000);
		activeService = harness.service;

		await harness.service.registerPlugin(makePlugin("plugin-a"));
		await harness.service.registerPlugin(makePlugin("plugin-b"));

		// The change handler suspends on plugin-a's lookup. stop() now tracks that
		// handler, so release the lookup after publishing shutdown intent and then
		// verify the resumed loop never advances to plugin-b.
		const change = harness.emitSecretChange();
		expect(lookupCalls).toBe(1);
		const stopping = harness.service.stop();
		releaseLookup?.(["TOKEN"]);
		await change;
		await stopping;

		expect(lookupCalls).toBe(1);
	});

	it("does not dispatch secret-change notifications after stop() is requested", async () => {
		let releaseLookup: ((missing: string[]) => void) | undefined;
		let lookupCalls = 0;
		const gate = new Promise<string[]>((resolve) => {
			releaseLookup = resolve;
		});
		const harness = await createHarness(async () => {
			lookupCalls += 1;
			if (lookupCalls === 1) {
				return [];
			}
			return gate;
		});
		activeService = harness.service;

		const onSecretChangedA = vi.fn(async () => undefined);
		await harness.service.registerPlugin(
			makePlugin("plugin-a", onSecretChangedA),
		);
		await harness.emitSecretChange();
		expect(harness.service.isActivated("plugin-a")).toBe(true);
		expect(onSecretChangedA).toHaveBeenCalledTimes(1);

		// Register listeners only after the legitimate activation notification so
		// any invocation below is unambiguously post-stop behavior.
		const keyedListener = vi.fn(async () => undefined);
		const globalListener = vi.fn(async () => undefined);
		harness.service.onSecretChangedKey("TOKEN", keyedListener);
		harness.service.onAnySecretChanged(globalListener);

		await harness.service.registerPlugin(makePlugin("plugin-b"));

		// A poll and a change handler both suspend on the same lookup gate.
		await vi.advanceTimersByTimeAsync(1);
		const change = harness.emitSecretChange();
		const stopping = harness.service.stop();

		releaseLookup?.([]);
		await change;
		await stopping;
		await vi.advanceTimersByTimeAsync(0);

		// Only the legitimate pre-shutdown plugin notification remains, and no
		// registered listener is invoked while the service drains.
		expect(onSecretChangedA).toHaveBeenCalledTimes(1);
		expect(keyedListener).not.toHaveBeenCalled();
		expect(globalListener).not.toHaveBeenCalled();
	});

	it("drains an in-flight notification without starting later callbacks", async () => {
		const harness = await createHarness(async () => [], 1000);
		activeService = harness.service;

		let markSecondAStarted: (() => void) | undefined;
		const secondAStarted = new Promise<void>((resolve) => {
			markSecondAStarted = resolve;
		});
		let releaseSecondA: (() => void) | undefined;
		const secondAGate = new Promise<void>((resolve) => {
			releaseSecondA = resolve;
		});
		let aCalls = 0;
		const onSecretChangedA = vi.fn(async () => {
			aCalls += 1;
			if (aCalls === 2) {
				markSecondAStarted?.();
				await secondAGate;
			}
		});
		const onSecretChangedB = vi.fn(async () => undefined);

		await harness.service.registerPlugin(
			makePlugin("plugin-a", onSecretChangedA),
		);
		await harness.service.registerPlugin(
			makePlugin("plugin-b", onSecretChangedB),
		);

		// Activate both plugins and deliver one legitimate notification to each.
		await harness.emitSecretChange();
		expect(onSecretChangedA).toHaveBeenCalledTimes(1);
		expect(onSecretChangedB).toHaveBeenCalledTimes(1);

		const keyedListener = vi.fn(async () => undefined);
		const globalListener = vi.fn(async () => undefined);
		harness.service.onSecretChangedKey("TOKEN", keyedListener);
		harness.service.onAnySecretChanged(globalListener);

		// The second notification reaches A and suspends inside its callback before
		// B or either listener is visited. Shutdown must drain A, but it must not
		// return early or start any later callback after shutdown intent is visible.
		const change = harness.emitSecretChange();
		await secondAStarted;

		let stopResolved = false;
		const stopping = harness.service.stop().then(() => {
			stopResolved = true;
		});
		await Promise.resolve();
		expect(stopResolved).toBe(false);

		releaseSecondA?.();
		await change;
		await stopping;

		expect(stopResolved).toBe(true);
		expect(onSecretChangedA).toHaveBeenCalledTimes(2);
		expect(onSecretChangedB).toHaveBeenCalledTimes(1);
		expect(keyedListener).not.toHaveBeenCalled();
		expect(globalListener).not.toHaveBeenCalled();
	});

	it("still notifies activated plugins while the service is running", async () => {
		const harness = await createHarness(async () => []);
		activeService = harness.service;

		const onSecretChangedA = vi.fn(async () => undefined);
		await harness.service.registerPlugin(
			makePlugin("plugin-a", onSecretChangedA),
		);
		await harness.emitSecretChange();
		expect(harness.service.isActivated("plugin-a")).toBe(true);

		await harness.emitSecretChange();
		expect(onSecretChangedA).toHaveBeenCalledTimes(2);
	});
});

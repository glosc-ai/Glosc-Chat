import type { ModelParameters, UserSettings } from "../domain/types";

export const defaultParameters: ModelParameters = {
  temperature: 0.7,
  topP: 1,
  maxTokens: 4096,
  presencePenalty: 0,
  frequencyPenalty: 0,
};

export const defaultSettings: UserSettings = {
  onboardingCompleted: false,
  darkMode: false,
  fontSize: "medium",
  redactLogs: true,
  localOnly: true,
  defaultModelId: null,
  contextMessageLimit: 16,
};

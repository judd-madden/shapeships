import { projectId } from './info';

const deployedGameFunctionBaseUrl =
  `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab`;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

const configuredGameFunctionBaseUrl =
  import.meta.env.VITE_GAME_FUNCTION_BASE_URL?.trim();

export const gameFunctionBaseUrl = normalizeBaseUrl(
  configuredGameFunctionBaseUrl || deployedGameFunctionBaseUrl
);

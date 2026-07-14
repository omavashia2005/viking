export interface Ide {
  id: string;
  name: string;
  // null = no config detected on this machine; setup skips gracefully.
  locateConfig(): { dir: string; entryFile: string } | null;
  pluginPath(configDir: string): string;
  entryRequire: string; // line to add into the init/entry file
}

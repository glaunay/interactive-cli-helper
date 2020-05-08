export const PROPERTY_METADATA_KEY = Symbol('CommandMetadata');
export const LISTENER_KEY = Symbol('CliListener');

export function isInstanceOfMainOrCommand(target: any) {
  if (LISTENER_KEY in target) {
    
  }
}


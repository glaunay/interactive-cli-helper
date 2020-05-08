import 'reflect-metadata';
import CliHelper, { CliExecutor, CliSuggestor, CliListener, CliValidator } from ".";
import { LISTENER_KEY, PROPERTY_METADATA_KEY } from "./helpers";

export interface CliMainProps {
  onNoMatch: CliExecutor;
  suggestions?: boolean;
  onSuggest?: CliSuggestor;
  onClose?: () => void;
  onError?: (err: Error) => void;
}

export interface CliCommandProps {
  executor: CliExecutor;
  onSuggest?: CliSuggestor;
  onValidateBefore?: CliValidator;
}

export type CliMainClass<T> = { 
  new (...args: any[]): CliMainInstance<T>, 
} & T;
export type CliMainInstance<T> = CliMainProps & { listen(): void, question(question: string): Promise<string>, [LISTENER_KEY]: CliHelper } & T;

export type CliCommandClass<T> = { 
  new (...args: any[]): CliCommandInstance<T>;
} & T;
export type CliCommandInstance<T, K = undefined> = CliCommandProps & { [LISTENER_KEY]: CliListener, parent: K } & T;
export type CliLocalCommandOptions = { onValidateBefore?: string | symbol | CliValidator, onSuggest?: string | symbol | CliSuggestor };

interface ISingleCommandMetadata {
  name: string | RegExp;
  executor?: { new (...args: any[]): CliCommandClass<any> };
  local?: {
    executor: string | symbol;
    options?: CliLocalCommandOptions;
  }
}
type IAllCommandMetadata = {
  // @ts-ignore
  [key: string | number | symbol]: ISingleCommandMetadata;
}

export class CliBase {
  listen() {}

  async question(question: string) {
    return "";
  }

  close() {}
}

function constructListenersFromObject(obj: any) {
  const metadata: IAllCommandMetadata = Reflect.getMetadata(PROPERTY_METADATA_KEY, obj) ?? {};
  
  for (const key of Reflect.ownKeys(metadata)) {
    // @ts-ignore
    const data = metadata[key] as ISingleCommandMetadata;

    if (data.executor) {
      const exec = new data.executor();
      exec.parent = obj;
      obj[LISTENER_KEY].command(data.name, exec[LISTENER_KEY]);
      obj[key] = exec;
    }
    else if (data.local) {
      const exec_fn: CliExecutor = obj[data.local.executor];

      const options = data.local.options;
      if (options) {
        if (typeof options.onSuggest === 'string' || typeof options.onSuggest === 'symbol') {
          options.onSuggest = obj[options.onSuggest]?.bind(obj);
        }
        if (typeof options.onValidateBefore === 'string' || typeof options.onValidateBefore === 'symbol') {
          options.onValidateBefore = obj[options.onValidateBefore]?.bind(obj);
        }
      }

      const listener = obj[LISTENER_KEY].command(data.name, exec_fn, data.local.options);

      obj[key] = listener;
    }
  }
}

export function CliMain(opts?: { suggestions?: boolean }) {
  return function CliMain<T extends { new (...args: any[]): CliMainProps }>(Initial: T) : CliMainClass<T> {
    // @ts-ignore
    return class extends Initial {
      [LISTENER_KEY]: CliHelper;
  
      constructor(...args: any[]) {
        super(...args);
  
        this[LISTENER_KEY] = new CliHelper({
          onNoMatch: (typeof this.onNoMatch === 'function' ? this.onNoMatch.bind(this) : this.onNoMatch),
          onCliClose: this.onClose?.bind(this),
          onCliError: this.onError?.bind(this),
          suggestions: opts?.suggestions ?? true,
          onSuggest: this.onSuggest?.bind(this),
        });
        
        constructListenersFromObject(this);
      }
  
      listen() {
        return this[LISTENER_KEY].listen();
      }
  
      question(question: string) {
        return this[LISTENER_KEY].question(question);
      }

      close() {
        return this[LISTENER_KEY].close();
      }
    };
  }
}

export function CliCommand() {
  return function CliCommand<T extends { new (...args: any[]): CliCommandProps }>(Initial: T) : CliCommandClass<T> {
    // @ts-ignore
    return class extends Initial {
      [LISTENER_KEY]: CliListener;
      parent: any = undefined;
  
      constructor(...args: any[]) {
        super(...args);
  
        this[LISTENER_KEY] = new CliListener(this.executor, {
          onSuggest: this.onSuggest?.bind(this),
          onValidateBefore: this.onValidateBefore?.bind(this),
        });
  
        constructListenersFromObject(this);
      }
    }
  }
}

export function Command(name: string | RegExp, executor: CliCommandClass<any>) {
  const updates: ISingleCommandMetadata = {
    name,
    executor
  };

  return (target: any, propertyKey: string | symbol) => {
    // Pull the existing metadata or create an empty object
    const allMetadata = Reflect.getMetadata(PROPERTY_METADATA_KEY, target) || {};
    // Ensure allMetadata has propertyKey
    allMetadata[propertyKey] = allMetadata[propertyKey] || {};

    // Update the metadata with anything from updates
    for (const key of Reflect.ownKeys(updates)) {
      // @ts-ignore
      allMetadata[propertyKey][key] = updates[key];
    }
    // Update the metadata
    Reflect.defineMetadata(
      PROPERTY_METADATA_KEY,
      allMetadata,
      target,
    );
  }
}

export function LocalCommand(name: string | RegExp, executor: string | symbol, options?: CliLocalCommandOptions) {
  const updates: ISingleCommandMetadata = {
    name,
    local: {
      executor,
      options
    }
  };

  return (target: any, propertyKey: string | symbol) => {
    // Pull the existing metadata or create an empty object
    const allMetadata = Reflect.getMetadata(PROPERTY_METADATA_KEY, target) || {};
    // Ensure allMetadata has propertyKey
    allMetadata[propertyKey] = allMetadata[propertyKey] || {};

    // Update the metadata with anything from updates
    for (const key of Reflect.ownKeys(updates)) {
      // @ts-ignore
      allMetadata[propertyKey][key] = updates[key];
    }
    // Update the metadata
    Reflect.defineMetadata(
      PROPERTY_METADATA_KEY,
      allMetadata,
      target,
    );
  }
}

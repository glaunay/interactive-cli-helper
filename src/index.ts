import readline from 'readline';

/**
 * Matched item. If `string`: matched command, else, matched `RegExp` plus the match array.
 */
export type CliStackItem = string | [RegExp, RegExpMatchArray]; 
/**
 * Function that should validate or not if the listener could be called.
 */
export type CliValidator = (rest: string, regex_matches: RegExpMatchArray | null) => boolean | Promise<boolean>;
/**
 * Function that is called when the command is matched.
 * 
 * **{rest}** is the rest of matched string after matching & trimming
 * 
 * **{stack}** is the stack of matched things until this command.
 * 
 * **{regex_matches}** is defined if the command is a {RegExp} object.
 * 
 * **{validator_state}** is defined if this listener is precedated by a validator. 
 * If it is `true`, validator is checked.
 * If `false`, then a **sub-command** that have a validator has failed its validation.
 */
export type CliExecutorFunction = (rest: string, stack: CliStackItem[], regex_matches: RegExpMatchArray | null, validator_state?: boolean) => any;
/**
 * Function to return suggestions from a given string.
 */
export type CliSuggestor = (rest: string) => string[] | Promise<string[]>;
/**
 * Valid object as executor. Can be a function (see `CliExecutorFunction`), a raw string or object.
 */
export type CliExecutor = CliExecutorFunction | string | object;

export interface CliListenerOptions {
  /**
   * If command execution (and all its sub-commands) need to check a constraint, you can specify
   * it here. The function must return a `boolean` or a `Promise<boolean>`.
   * If {executor} is a `CliListener` instance, this will overwrite its previously set {onValidateBefore}.
   * 
   * If the `boolean` is `true`, continue the execution normally (sub-command then executor if none match).
   * 
   * If the `boolean` is `false`, the executor only will be called with its `validator_state` (third) parameter to `false`.
   */
  onValidateBefore?: CliValidator, 
  /** Callback to execute to suggest things into the CLI from this command listener. */
  onSuggest?: CliSuggestor,
}

export class CliListener {
  protected listeners: Map<string | RegExp, CliListener> = new Map;
  protected validator?: CliValidator;
  protected suggestor?: CliSuggestor;

  constructor(protected executor: CliExecutor, options?: CliListenerOptions) { 
    this.validator = options?.onValidateBefore;
    this.suggestor = options?.onSuggest;
  }

  /**
   * Add a new command listener for {command_name}.
   *  
   * Return the newly created `CliListener`, which where you can create another sub-listeners.
   * 
   * @param command_name The thing(s) that the new command listener should match to.
   * 
   * @param executor The function that should be executed if command is matched, 
   * and none of its sub-command has matched. If the returned thing is static, you can directly specify it (`string` or `object`).
   * You can return a `Promise`, the CLI instance will wait its finish before giving back the control !
   * 
   * @param options.onValidateBefore If command execution (and all its sub-commands) need to check a constraint, you can specify
   * it here. The function must return a `boolean` or a `Promise<boolean>`.
   * If {executor} is a `CliListener` instance, this will overwrite its previously set {onValidateBefore}.
   * 
   * If the `boolean` is `true`, continue the execution normally (sub-command then executor if none match).
   * 
   * If the `boolean` is `false`, the executor only will be called with its `validator_state` (third) parameter to `false`.
   * 
   * @param options.onSuggest Callback to execute to suggest things into the CLI from this command listener.
   */
  command(command_name: string | RegExp | Array<RegExp | string>, executor: CliExecutor | CliListener, options?: CliListenerOptions) {
    let new_one: CliListener;

    if (executor instanceof CliListener) {
      new_one = executor;
      if (options?.onValidateBefore)
        executor.validator = options.onValidateBefore;
      if (options?.onSuggest)
        executor.suggestor = options.onSuggest;
    }
    else {
      new_one = new CliListener(executor, options);
    }

    if (Array.isArray(command_name)) {
      for (const e of command_name) {
        this.listeners.set(e, new_one);
      }
    }
    else {
      this.listeners.set(command_name, new_one);
    }

    return new_one;
  }

  /**
   * Try to match a sub-listener. 
   * If any sub-listener matches, then execute the current executor.
   * 
   * @param rest Rest of the string, after the things that have been matched.
   * @param matches Regular expression matches array. `null` if the thing that have matched is a string.
   */
  async match(rest: string, stack: CliStackItem[], matches: RegExpMatchArray | null): Promise<any> {
    let validator_state: boolean | undefined = undefined;

    if (this.validator) {
      validator_state = await this.validator(rest, matches);
    }

    if (validator_state !== false) {
      for (const matcher of this.listeners.keys()) {
        if (typeof matcher === 'string') {
          if (rest.startsWith(matcher)) {
            return this.listeners.get(matcher)!.match(rest.slice(matcher.length).trimLeft(), [...stack, matcher], null);
          }
        }
        else {
          const matches = rest.match(matcher);

          if (matches) {
            return this.listeners.get(matcher)!.match(rest.replace(matcher, '').trimLeft(), [...stack, [matcher, matches]], matches);
          }
        }
      }
    }

    if (typeof this.executor === 'function')
      return this.executor(rest, stack, matches, validator_state);
    return this.executor;
  }

  protected isValid(rest: string) {
    if (rest.length === 0) {
      return true;
    }
    if (rest[0].trim().length === 0) {
      return true;
    }
    return false;
  }

  protected async getSuggests(rest: string, stop_on_next = false) : Promise<[string[], string]> {
    const matches: string[] = [];

    for (const matcher of this.listeners.keys()) {
      if (matcher instanceof RegExp) {
        continue;
      }

      const splittedone = rest.split(/\s+/)[0];
      let stop = stop_on_next;

      // Stop when suggestion level > 1
      if (!splittedone.length) {
        if (stop) {
          continue;
        }
        stop = true;
      }

      if (matcher.startsWith(splittedone) && this.isValid(rest.slice(matcher.length))) {
        const after_matcher = rest.slice(matcher.length);
        const size_after_tleft = after_matcher.trimLeft().length;

        const padding = after_matcher.slice(0, after_matcher.length - size_after_tleft) || " ";

        const m_all = (await this.listeners.get(matcher)!.getSuggests(after_matcher.trimLeft(), stop))[0];

        matches.push(
          matcher,
          ...m_all.map(e => matcher + padding + e), 
        );
      }
    }

    if (matches.length === 0 && !stop_on_next && this.suggestor) {
      const user_matches = await this.suggestor(rest);

      return [
        user_matches, 
        rest
      ];
    }

    return [matches, rest];
  }
}

export interface CliHelperOptions { 
  /**
   * Function to execute / Object to show when no command matches.
   */
  onNoMatch: CliExecutor, 
  /**
   * Enable suggestion with `tab` key for this instance. Suggestions does **not work** with `RegExp` based listeners.
   */
  suggestions?: boolean, 
  /**
   * If no command matches, you can specify here a function to call to return suggestions from user entry.
   */
  onSuggest?: CliSuggestor,
  /**
   * Function to call when CLI is closed (for example, with CTRL+C).
   * 
   * Default to
   * ```
   * () => console.log("Goodbye.")
   * ```
   */
  onCliClose?: () => void,
  /**
   * Function to call when a listener throw something or return an `Error` object.
   * If the command listener throw something that is **not** an `Error`, it is wrapped inside one.
   * 
   * Default to
   * ```
   * error => console.warn(`Error encountered in CLI: ${error.message} (${error.stack})`)
   * ```
   */
  onCliError?: (error: Error) => void,
}

export default class CliHelper extends CliListener {
  protected enable_suggestions: boolean;
  protected rl_interface: readline.Interface | undefined;
  protected on_question = false;

  /**
   * Build a new instance of `CliHelper`. 
   * 
   * Add keywords/patterns you want to catch with `.addSubListener()`.
   * 
   * @param no_match_executor The function that will be called if none of the defined sub-listeners matched.
   * If the returned value is static, you can specify a static `string` or `object`.
   */
  constructor(options: CliHelperOptions) {
    super(options.onNoMatch, { onSuggest: options.onSuggest });
    this.enable_suggestions = options.suggestions ?? true;
    this.onclose = options.onCliClose ?? this.onclose;
    this.onerror = options.onCliError ?? this.onerror;
  }

  public onclose = () => {
    console.log('Goodbye.');
  };

  public onerror = (error: Error) => {
    console.warn(`Error encountered in CLI: ${error.message} (${error.stack})`);
  };

  /**
   * Provide a method to generate a handler that print help messages in a fancy way.
   * 
   * **{title}**: Title of help (generally, the command)
   *
   * **{options.commands}**: Available sub-commands on this handler.
   * 
   * **{options.description}**: Put a description below {title}.
   * 
   * **{options.onNoMatch}**: When user enter something that does not match after this command, this is executed.
   * ```ts
   * // Example: You defined help for "hello" with
   * const help = CliHelper.formatHelp(
   *   "hello", 
   *   { 
   *     commands: { foo: 'Foo description', world: 'Says "Hello world!"' }, 
   *     onNoMatch: rest => `Subcommand "${rest}" does not exists for "hello".` 
   *   }
   * );
   * 
   * cli.command(
   *  "hello", 
   *  
   * );
   * 
   * // Then, the following will happen in CLI:
   * > hello t
   * Cli: Subcommand "t" does not exists for "hello".
   * > hello
   * Cli:
   * hello
   *    foo   Foo description
   *  world   Says "Hello world!"
   * ```
   */
  static formatHelp(title: string, options: {
    commands: {
      [name: string]: string
    }, 
    onNoMatch?: CliExecutor,
    description?: string,
  }) {
    let entries = Object.entries(options.commands);
    const PADDING = 3;

    const SIZE = Math.max(...entries.map(e => e[0].length)) + PADDING;
    const PAD_START = "    ";

    entries = entries.map(e => [e[0].padEnd(SIZE, " "), e[1]]);

    if (options.description) {
      title = title + '\n' + PAD_START + options.description;
    }

    const content = entries.map(e => `${PAD_START}${e[0]}${e[1]}`).join('\n');

    return (options.onNoMatch ? 
      (rest: string, stack: CliStackItem[]) => {
        if (rest.trim()) {
          return typeof options.onNoMatch === 'function' ? options.onNoMatch(rest, stack, null) : options.onNoMatch;
        }
        return `\n${title}\n${content}`;  
      } : 
      `\n${title}\n${content}`
    );
  }

  protected initReadline() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
      completer: this.enable_suggestions ? (line: string, callback: (err: any, value?: [string[], string]) => void) => {
        if (buffer) {
          // todo: complete when line is incomplete
          return [[], line];
        }

        this.getSuggests(line)
          .then(s => {
            callback(
              null, 
              [s[0].filter(e => e.startsWith(line) && e.length > line.length), s[1]]
            );
          })
          .catch(callback);
      } : undefined,
    });

    this.rl_interface = rl;
    let buffer = '';

    rl.on('line', async line => {
      if (this.on_question) {
        return;
      }

      line = buffer + line;

      if (!line) {
        rl.prompt();
        return;
      }

      if (line.endsWith('\\')) {
        buffer = line.slice(0, line.length - 1) + ' ';
        process.stdout.write('+ ');
        return;
      }

      let returned: any;
      try {
        returned = await this.match(line.trim(), [], null);
      } catch (e) {
        if (e instanceof Error) {
          returned = e;
        }
        else {
          returned = new Error(e);
        }
      }

      if (typeof returned === 'string') {
        console.log("cli: " + returned);
      }
      else if (returned instanceof Error) {
        if (this.onerror) {
          this.onerror(returned);
        }
      }
      else if (typeof returned === 'object') {
        console.log("cli:", returned);
      }

      // Reprompt for user input
      buffer = "";
      rl.prompt();
    }).on('close', () => {
      if (this.onclose) {
        this.onclose();
      }
      
      process.exit(0);
    });
  }

  /**
   * Pause the CLI, and ask a question.
   * When question is answered, the CLI goes back.
   */
  question(question: string) : Promise<string> {
    if (!this.rl_interface) {
      this.initReadline();
    }

    this.on_question = true;

    return new Promise(resolve => {
      this.rl_interface!.question(question, answer => {
        this.on_question = false;
        resolve(answer);
      });
    });
  }

  /**
   * Close the prompt session.
   */
  close() {
    if (this.rl_interface)
      this.rl_interface.close();
  }

  /**
   * Starts the listening of `stdin`.
   * 
   * Before that, please define the keywords 
   * you want to listen to with `.command()`.
   */
  listen() {
    this.on_question = false;
    this.initReadline();
    this.rl_interface!.prompt();
  }
}

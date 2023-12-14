import { CliExecutor, CliSuggestor, CliStackItem } from ".";
import { CliListener } from "./CliListener";
import readline from 'readline';

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
  promptString:string = '>> ';
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
      prompt: this.promptString,
      completer: this.enable_suggestions ? (line: string, callback: (err: any, value?: [string[], string]) => void) => {
        if (buffer) {
          // todo: complete when line is incomplete
          return [[], line];
        }

        this.getSuggests(line, [])
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
          returned = new Error(e as any);
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

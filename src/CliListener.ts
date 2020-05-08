import { CliValidator, CliSuggestor, CliExecutor, CliStackItem } from ".";

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

  protected async getSuggests(rest: string, stack: CliStackItem[], stop_on_next = false) : Promise<[string[], string]> {
    const matches: string[] = [];

    for (const matcher of this.listeners.keys()) {
      const splittedone = rest.split(/\s+/)[0];
      let stop = stop_on_next;

      // Stop when suggestion level > 1
      if (!splittedone.length) {
        if (stop) {
          continue;
        }
        stop = true;
      }

      if (typeof matcher === 'string' && matcher.startsWith(splittedone) && this.isValid(rest.slice(matcher.length))) {
        const after_matcher = rest.slice(matcher.length);
        const size_after_tleft = after_matcher.trimLeft().length;

        const padding = after_matcher.slice(0, after_matcher.length - size_after_tleft) || " ";

        const m_all = (await this.listeners.get(matcher)!.getSuggests(after_matcher.trimLeft(), [...stack, matcher], stop))[0];

        matches.push(
          matcher,
          ...m_all.map(e => matcher + padding + e), 
        );
      }
      else if (matcher instanceof RegExp) {
        const reg_match = splittedone.match(matcher);

        if (reg_match && this.isValid(rest.slice(reg_match[0].length))) {
          const after_matcher = rest.slice(reg_match[0].length);
          const size_after_tleft = after_matcher.trimLeft().length;

          const padding = after_matcher.slice(0, after_matcher.length - size_after_tleft) || " ";

          const m_all = (await this.listeners.get(matcher)!.getSuggests(after_matcher.trimLeft(), [...stack, [matcher, reg_match]], stop))[0];

          matches.push(
            reg_match[1],
            ...m_all.map(e => reg_match[0] + padding + e), 
          );
        }
      }
    }

    if (!stop_on_next && this.suggestor) {
      const user_matches = await this.suggestor(rest, stack);

      return [
        [...matches, ...user_matches], 
        rest
      ];
    }

    return [matches, rest];
  }
}

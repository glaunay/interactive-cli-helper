
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
export type CliSuggestor = (rest: string, stack: CliStackItem[]) => string[] | Promise<string[]>;
/**
 * Valid object as executor. Can be a function (see `CliExecutorFunction`), a raw string or object.
 */
export type CliExecutor = CliExecutorFunction | string | object;

export * from './CliHelper';
export * from './CliListener';
export * from './decorators';

import CliHelper from './CliHelper';
export default CliHelper;


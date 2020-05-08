# interactive-cli-helper

> Create a simple interactive CLI for your Node.js applications

## Getting started

Install the package with `npm`.

```bash
npm i interactive-cli-helper
```

You can use this package through two different modes, functional or class-based declarations.

## How it works

This package will listen on `stdin` after you called `.listen()` method of a main helper.
If the user enter commands, it will try to match the commands you've declarated.

To see API, see next section.

### Answer to entered command

When you declare a command handler, you must specify a matcher (either a `string` or a `RegExp`) and a `CliExecutor` to execute.
A `CliExecutor` is either a `string` or `object` to show, or a `function` to call with specific arguments.

```ts
import { CliExecutor, CliStackItem } from 'interactive-cli-helper';

// Types of CliExecutor
const str_executor: CliExecutor = "Hello !";
const obj_executor: CliExecutor = { prop1: 'foo', prop2: 'bar' };
const fn_executor: CliExecutor = function (
  /** The rest of the string -after- matched command. */
  rest: string, 
  /** Stack of matched commands until this listener is called. */
  stack: CliStackItem[],
  /** If current listener command is a RegExp, this is the matches array. Else, null */
  matches: RegExpMatchArray | null, 
  /** If current listener has a validator, this is its state. */
  validator_state?: boolean
) {
  // You can return anything here. If you return a Promise, it is awaited before showing next prompt.
  return "Hello!";
};
```

### Validate user entry before executing a command

If you want to check if user entry is valid before trying to match sub-commands, you can use a `CliValidator`.

```ts
import { CliValidator } from 'interactive-cli-helper';

const validator: CliValidator = (rest: string, regex_matches: RegExpMatchArray | null) => {
  // Return a `boolean` or a `Promise<boolean>` to validate or not.
  return true;
};
```

If the validator fails (returns `false`), then sub-commands will not be matched and 
current failed command executor will be called with `validator_state` parameter to `false`.


## Functional mode

### Main helper

To start using CLI helper, you need the main helper, that can handle `stdin` listen actions.

```ts
import CliHelper from 'interactive-cli-helper';

const cli = new CliHelper({
  /* Mandatory. To execute if none of the commands are matched. */
  onNoMatch: CliExecutor, 
  /* See Suggestions part */
  onSuggest?: CliSuggestor,
  /* Enable suggestion on tab keypress. Defauls to true. */
  suggestions?: boolean,
  /* Function to call when CLI is closed by CTRL+C. */
  onCliClose?: Function,
  /* Function to call when a command throw something. */
  onCliError?: (error: Error) => void,
});

// Declare your commands here..

// Listen !
cli.listen();
```

### Set commands

To declare command, use the `.command()` method. This will return a new `CliListener` instance to use if you want to declare sub-commands.

```ts
(CliHelper or CliListener).command(name: string | RegExp, executor: CliExecutor, options: CliListenerOptions);

// For example
// database
const database_cli = cli.command('database', 'Please enter a thing to do with database !');

// database test
database_cli.command('test', async () => {
  if (await Database.test()) {
    return 'Database works :D';
  }
  return 'Database is not working :(';
});

// database get
const getter = database_cli.command('get', 'Specify which thing to get');

// database get products
const products = getter.command('products', async () => {
  const products = await Database.getProducts();
  return products;
});
// database get products coffee-**
products.command(/coffee-(.+)/, async (_, matches) => {
  const wanted = matches[1];
  const coffee_products = await Database.getCoffeeProducts();

  return coffee_products.filter(e => e.name.startsWith(wanted));;
});


getter.command('users', () => Database.getUsers());

const hello_sayer = cli.command('say-hello', 'Hello world!');

// The following cli tree will be created:
// database
//  database test
//  database get
//    database get products
//      database get products coffee-(.+)
//    database get users
// say-hello
```


## Class-declarated mode

You need to use TypeScript in your project and enable experimental decorators to use this.


## Suggestions

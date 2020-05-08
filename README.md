# interactive-cli-helper

> Create a simple interactive CLI for your Node.js applications

## Getting started

Install the package with `npm`.

```bash
npm i interactive-cli-helper
```

You can use this package through two different modes, functional or class-based declarations.

## Simple usage

```ts
import CliHelper from 'interactive-cli-helper';

const cli = new CliHelper({
  // onNoMatch executor: Will be displayed/called if none command matches
  onNoMatch: rest => `Command ${rest} not found.`
});

const get_command = cli.command(
  // command name: string or RegExp
  'get', 
  // executor: CliListener, object, string or function to call
  'Please specify a thing to get.'
);

// executors could be async!
get_command.command('ponies', async () => {
  const ponies = await getPonies();
  return ponies.map(e => e.name);
});

const pies = get_command.command('pies', () => {
  return `Available pies are:\n${getPies().map(e => e.name).join('\n')}`;
});

// You can get what's after matched command with the first parameter
pies.command('add', async rest => {
  const added_pie = await addPie({ name: rest });
  // You can return plain objects!
  return added_pie;
});

cli.listen();
```

Example output for this example code:

```
> hello
cli: Command hello not found
> get
cli: Please specify a thing to get.
> get ponies
cli: [ 'twilight', 'rainbow dash' ]
> get pies
cli: Available pies are:
cake
> get pies add cake
Error encountered in CLI: Pie already exists. (Error: Pie already exists.
 at addPie (basic.test.js:13:15)
 at CliListener.executor (basic.test.js:38:29)
 ...)
> get pies add other cake
cli: { name: 'other cake' }
> get pies
cli: Available pies are:
cake
other cake
```

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

### Use validators

Get back on our previous example. It could be useful if, before accessing every `database` command, we check if database is accessible.

For this, we will modify the declaration of `database_cli` handler.

```ts
const database_cli = cli.command(
  // Name. We won't change it
  'database', 
  // Handler: it will be executed if database is not followed
  // by any command, if commad does not exists, or if
  // our next defined validator fails !
  (rest, _, __, validator_state) => {
    if (validator_state === false) {
      // Database is not open !
      return 'Database is not ready. You can\'t use database functions.';
    }

    if (rest.trim()) {
      return 'database: Command not found.';
    }
    return 'Please enter a thing to do with the database.';
  },
  {
    // define our validator here (could be async or not)
    // that returns a boolean
    async onValidateBefore(/* rest, matches */) {
      const test = await Database.testAvailability();
      return test;
    },
  }
);
```

Now, all the sub-database commands will check if database is ready before executing.


## Class-declarated mode

You need to use TypeScript in your project and enable experimental decorators to use this.

This declaration mode is experimental.

```ts
import { CliMain, CliBase, LocalCommand, Command, CliCommand, CliCommandInstance } from 'interactive-cli-helper';

@CliCommand()
class Command2 {
  // Executor for Command2
  executor: CliExecutor = "Hello";
}

@CliCommand()
class Command1 {
  executor: CliExecutor = rest => {
    return "You just entered " + rest + ".";
  };

  // validator for Command1 command listener
  onValidateBefore: CliValidator = () => {
    return true;
  };

  // Include Command2 as 'two' command
  @Command('two', Command2)
  command_two!: CliCommandInstance<Command2>;

  // Declare a local clilistener for this instance
  @LocalCommand('local-1', 'localOne', { onValidateBefore: 'validateLocalOne' })
  local_one_cmd!: CliListener;

  // Executor for local-1
  localOne(rest: string) {
    return "This is local one command".
  }

  // Check if local-1 can be executed.
  validateLocalOne(rest: string) {
    return true;
  }
}

@CliMain({ suggestions: true })
class Main extends CliBase {
  onNoMatch: CliExecutor = "No command matched your search.";

  // Assign Command1 for 'one' command
  @Command('one', Command1)
  command_one!: CliCommandInstance<Command1>;
}

const helper = new Main();
helper.listen();
```

## How it works

This package will listen on `stdin` after you called `.listen()` method of a main helper.
If the user enter commands, it will try to match the commands you've declarated.

To see API, see previous section.

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

### Suggest manually

When your command has user-defined suggestions, like database IDs or something, you can use manually a function to returns suggestions to user.

```ts
import { CliSuggestor } from 'interactive-cli-helper';

const suggestor: CliSuggestor = (rest: string) => {
  return ['suggestion1', 'suggestion2']; // or Promise<string>
};

// Declare it
const something_cmd = cli.command('something', 'handler', {
  onSuggest: suggestor,
});

something_cmd.command(/^suggestion\d$/, 'Suggestions matched :D');

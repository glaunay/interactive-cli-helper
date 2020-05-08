import { CliMain, CliCommand, Command, CliCommandInstance, CliBase, LocalCommand } from "./decorators";
import { CliValidator, CliExecutor, CliListener } from ".";

@CliCommand()
class Test {
  executor: CliExecutor = "This is a test";
}

@CliCommand() 
class SecondTest {
  executor: CliExecutor = rest => {
    return `You just entered ${rest} after this command.`;
  };
}

@CliCommand()
class Hello {
  executor: CliExecutor = "Hello :D";

  @Command('test', Test)
  test_cmd!: CliCommandInstance<Test>;

  @Command('other', SecondTest)
  second_test_cmd!: CliCommandInstance<SecondTest>;

  @LocalCommand('local', 'local', { onValidateBefore: 'localValidate' })
  local_cmd!: CliListener;

  local: CliExecutor = (rest, stack, matches, validated) => {
    if (!validated) {
      return "Impossible de valider la commande local.";
    }
    return `
      Rest: ${rest}
      Stack: ${stack.join(', ')}
      Matches: ${matches}
      Validated: ${validated}
    `;
  }

  localValidate: CliValidator = () => {
    return Math.random() > .5;
  };
}

@CliMain({ suggestions: true })
class Main extends CliBase {
  onNoMatch: CliExecutor = "No command matched your search.";

  @Command('hello', Hello)
  hello_cmd!: CliCommandInstance<Hello>;
}

const helper = new Main();

helper.listen();

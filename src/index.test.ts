import CliHelper from '.';

const cli = new CliHelper({
  onNoMatch: "No match.",
});

const data = cli.command('data', CliHelper.formatHelp('data', { commands: { 'set': 'Show a set' } }));

const set = data.command('set', "Please choose set one or two");
set.command('one', 'Set 1', {
  onSuggest: () => ['three', 'four'],
});
set.command('two', 'Set 2', {
  onSuggest: () => ["five", "six", "seven", "eight", "nine", "ten"],
});

const help = cli.command('help', CliHelper.formatHelp('help', { commands: { 'title': 'Show a title.' } }));

const title = help.command('title', rest => {
  return "This is a title.";
});

title.command('un', "hello");

const deux = title.command('deux', (rest, stack) => {
  console.log(stack)
  return "This is a title.";
});

deux.command('hello', 'deux');

cli.listen();

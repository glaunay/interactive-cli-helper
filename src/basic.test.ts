import CliHelper, { CliSuggestor } from '.';

const available_pies = [{ name: 'cake' }];

function getPies() {
  return available_pies;
}

async function addPie(pie: { name: string }) {
  if (available_pies.some(e => e.name === pie.name)) 
    throw new Error("Pie already exists.");
  available_pies.push(pie);
  return pie;
}

async function getPonies() {
  return [{ name: 'twilight' }, { name: 'rainbow dash' }];
}


const cli = new CliHelper({
  // onNoMatch executor: Will be displayed/called if none command matches
  onNoMatch: rest => `Command ${rest} not found.`
});

const suggestor: CliSuggestor = (rest: string) => {
  return ['suggestion1', 'suggestion2']; // or Promise<string>
};

// Declare it
const something_cmd = cli.command('something', 'handler', {
  onSuggest: suggestor,
});

something_cmd.command(/^suggestion\d$/, 'Suggestions matched :D');

const get_command = cli.command(
  // command name: string or RegExp
  'get', 
  // executor: object, string or function to call
  'Please specify a thing to get.',
  { onSuggest: () => ['ponies', 'pones', 'poneees', 'poniiiiiesss'] },
);

// executors could be async!
const pons = get_command.command(/pon\w+s/, async () => {
  const ponies = await getPonies();
  return ponies.map(e => e.name);
});

const hello = pons.command('hello', 'Hello')
hello.command('underhello', 'Underhello');
hello.command('under2hello', 'Under2hello');


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

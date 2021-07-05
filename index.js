const assert = require('assert');
const Discord = require('discord.js');
const fs = require('fs');
const { get, set } = require('./nested-object-helpers');

//
// arg parsing
//
const argv = require('minimist')(process.argv.slice(2));
if (argv.help) {
  console.log('usage: gdq-bot flags');
  console.log('flags:');
  console.log('    --config         path to a config file (default is config.json)');
  console.log('    --ignore-first   ignore the first game change. useful to avoid duplicate');
  console.log('                     messages after restarting the bot.');
  process.exit(0);
}

let ignore = !!argv['ignore-first'];
const cfg = JSON.parse(fs.readFileSync(argv['config'] || 'config.json'));


function log(msg) {
  const d = new Date();
  console.log(`${d.toISOString()} ${msg}`);
}

function getLatestStats() {
  const file = fs.readFileSync(cfg.statsFile);
  const j = JSON.parse(file.toString());
  const now = new Date().getTime() / 1000;

  const validTotals = j.viewers.filter(v => v[1] && v[2]);
  const totals = validTotals[validTotals.length - 1];

  return {
    before: j.games.filter(g => g[0] < now),
    after: j.games.filter(g => g[0] >= now),
    totals,
  };
}

//
// subscription stuff
//
function getSubs() {
  try {
    return JSON.parse(fs.readFileSync('subs.json').toString());
  } catch (e) {
    return {};
  }
}

function getSubsForUser(subs, channelId, userId) {
  const foundSubs = [];
  Object.keys(subs).forEach((gameName) => {
    Object.keys(subs[gameName]).forEach((channelId) => {
      if (subs[gameName][channelId][userId]) {
        foundSubs.push({ gameName, channelId });
      }
    });
  });
  return foundSubs
    .filter(sub => sub.channelId === channelId)
    .map(sub => sub.gameName);
}

function persistSubs(subs) {
  fs.writeFileSync('subs.json', JSON.stringify(subs, null, 2));
}

function getHelpEmbed() {
  return new Discord.RichEmbed()
    .setTitle('gdqbert help')
    .setDescription('gdqbert responds to the following commands:')
    .addField('@gdqbert Game Name Here', 'get gdqbert to @ you when that game is starting.')
    .addField('@gdqbert update', 'get an update on the current and next game.')
    .addField('@gdqbert', 'find out which games gdqbert is going to @ you about.');
}

function findGame(gameName) {
  const file = fs.readFileSync(cfg.statsFile);
  const j = JSON.parse(file.toString());
  const foundGame = j.games.find(g => g[1].toLowerCase() === gameName.toLowerCase());
  const bestGuesses = j.games.filter(g => g[1].toLowerCase().includes(gameName.toLowerCase()));
  return { foundGame, bestGuesses };
}

function run() {
  const client = new Discord.Client();
  const subscriptions = getSubs();
  let currentGame = null;
  let after = [];

  function checkForNewGame(client, channelId, forceSend = false) {
    const stats = getLatestStats();
    after = stats.after;

    if (stats.before.length === 0 || stats.after.length === 0) {
      return;
    }

    const nowGame = stats.before[stats.before.length - 1][1];
    const nextGame = stats.after[0][1];

    const now = new Date().getTime() / 1000;
    const nextGameTime = stats.after[0][0];
    const timeDiff = nextGameTime - now;

    // if we're 10 minutes out from the next game, send the mentions
    if (!channelId && timeDiff < (60 * 10)) {
      log('10 mins from next game, checking for subscriptions');
      if (subscriptions[nextGame]) {
        subscriptions[nextGame].forEach((channelId) => {
          const mentions = Object.keys(subscriptions[nextGame][channelId]).join(' ');
          log(`mentioning ${mentions} in ${channelId}`);
          if (mentions.length > 0) {
            const channel = client.channels.get(channelId);
            channel.send(`${mentions} ${nextGame} is starting soon`);
            set(subscriptions, [nextGame, channelId], {});
          }
        });
        persistSubs(subscriptions);
      }
    }

    const foundNewGame = nowGame !== currentGame;
    if (foundNewGame) {
      log(`new game found ${nowGame}`);
      log(`old game was ${currentGame}`);
      currentGame = nowGame;
    }

    if (ignore) {
      log('ignore flag set, ignoring');
      ignore = false;
      return;
    }

    if (forceSend || foundNewGame) {
      if (forceSend) {
        log('forcing send');
      }

      const totalMins = timeDiff / 60;
      const hours = Math.floor(totalMins / 60);
      const mins = Math.floor(totalMins % 60);

      let nextTimeMsg = '';
      if (hours === 1) {
        nextTimeMsg = `in ${hours} hour ${mins} minutes`;
      } else if (hours > 1) {
        nextTimeMsg = `in ${hours} hours ${mins} minutes`;
      } else {
        nextTimeMsg = `in ${mins} minutes`;
      }

      const embed = new Discord.RichEmbed()
        .setTitle(cfg.marathonName)
        .setURL('https://twitch.tv/gamesdonequick')
        .addField('Current Game', currentGame)
        .addField('Next Game', `${nextGame} ${nextTimeMsg}`)
        .addField('Viewers', stats.totals[1], true)
        .addField('Donation Total', '$' + stats.totals[2].toFixed(0), true);

      if (channelId) {
        client.channels.get(channelId).send(embed);
      } else {
        cfg.channels.forEach(channelId => client.channels.get(channelId).send(embed));
      }
    }
  }

  function notYetPlayed(gameName) {
    return after.some(ag => ag[1].toLowerCase() === gameName.toLowerCase());
  }

  function subscribe(message, game) {
    log(`${message.author} trying to sub to ${game}`);
    const { foundGame, bestGuesses } = findGame(game);
    if (!foundGame) {
      let msg = `no game '${game}' found`;
      if (bestGuesses.length) {
        // only show games after this one
        const possibleGames = bestGuesses
          .map(g => g[1])
          .filter(notYetPlayed);
        msg += ` possible matches:\n${possibleGames.join('\n')}`;
      }
      return msg;
    }

    const gameName = foundGame[1];
    if (!notYetPlayed(gameName)) {
      return `that's already been played!!`;
    }

    const channelId = message.channel.id;
    const userId = message.author.toString();

    if (get(subscriptions, [gameName, channelId, userId])) {
      return `i'm already gonna yell at you when that starts!!`;
    }

    set(subscriptions, [gameName, channelId, userId], true);
    log(`${message.author} subbed to ${game}`);
    persistSubs(subscriptions);
    return `ok, i'll yell at you when ${gameName} starts`;
  }

  client.on('ready', () => {
    log('connected');
    setInterval(() => checkForNewGame(client), 1000 * 60);
    checkForNewGame(client);
  });

  client.on('message', (message) => {
    if (!message.isMentioned(client.user)) {
      return;
    }

    log(`(${message.guild.name}) (${message.channel.name}) ${message.author.username} ${message.content}`);
    const content = message.content;
    const re = /[^ ]+ (.*)$/;
    const match = re.exec(content);
    if (match && match.length == 2 && match[1].length > 0) {
      const game = match[1].trim();
      if (game === 'update') {
        checkForNewGame(client, message.channel.id, true);
      } else if (game === 'help') {
        message.channel.send(getHelpEmbed());
      } else {
        message.reply(subscribe(message, game));
      }
    } else {
      const author = message.author.toString();
      const subs = getSubsForUser(subscriptions, message.channel.id, author);
      if (subs.length > 0) {
        message.reply(`i'm gonna yell at you when these games start:\n${subs.join('\n')}`);
      } else {
        message.reply(`i'm not gonna yell at you when any game starts!!`);
      }
    }
  });

  // check once a minute
  client.login(cfg.botToken);
}

run();

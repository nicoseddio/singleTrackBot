const Discord = require('discord.js');
const ytdl = require("ytdl-core");

const auth = require('./auth.json');
const config = require('./config.json');
let connection = null;
let botStatus = `invisible`;

const client = new Discord.Client();
client.login(auth.token);

client.on('ready', () => {
    console.log();
    console.log(`Logged in as ${client.user.tag}!`);

    // appear invisible
    client.user.setPresence({
        status: botStatus
    });

    // join voicechannel
    client.channels.cache.get(config.voicechannel)
    .join().then(conn => {
        connection = conn;
        // Yay, it worked!
        console.log("Successfully connected.");
    }).catch(e => {
        // Oh no!
        console.error(e);
    });
});

client.on('message', async function(message) {
    // ignore self.
    if (message.author.id === client.user.id) return;

    // only respond to text channel in config.
    if (message.channel != config.textchannel) return;

    // only respond to admin users in config.
    if (!config.admins.includes(message.author.id)) return;

    // parse args
    let args = ["null"];
    if (message.content.length > 0)
        args = message.content.split(" ");

    // if message starts with mention and has multiple args
    if (args[0] === `<@!${client.user.id}>` && args.length > 1) {

        // parse command
        switch (args[1]) {
            case 'help':
                message.reply(`let's groove!\n`+
                    `- play { link }\n`+
                    `- stop\n`+
                    `- status`)
                break;
            case 'play':
                if (args.length > 2) {
                    try {
                        const songInfo = await ytdl.getInfo(args[2]);
                        const song = {
                            title: songInfo.videoDetails.title,
                            url: songInfo.videoDetails.video_url,
                        };
                        console.log(song);
                        connection.play(ytdl(song.url))
                        .on("error", error => console.error(error));
                        // dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
                    } catch (err) {
                        console.log(err);
                    }
                }
                break;
            case 'status':
                if (botStatus === 'online')
                    botStatus = 'invisible'
                else botStatus = 'online' 
                client.user.setPresence({
                    status: botStatus
                });
                break;
            default:
                message.reply('mew!');
        }
    } else {
        message.reply('mew!');
    }
    console.log(message.content);
});



// if (message.content.startsWith(`!play`)) {
//     execute(message, serverQueue);
//     return;
// } else if (message.content.startsWith(`!skip`)) {
//     skip(message, serverQueue);
//     return;
// } else if (message.content.startsWith(`!stop`)) {
//     stop(message, serverQueue);
//     return;
// }

async function execute(message, serverQueue) {
    const args = message.content.split(" ");

    const voiceChannel = config.voicechannel;
    if (!voiceChannel)
        return message.channel.send(
        "You need to be in a voice channel to play music!"
    );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "I need the permissions to join and speak in your voice channel!"
        );
    }

    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };

        this.queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            this.play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            this.queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
            serverQueue.songs.push(song);
            return message.channel.send(`${song.title} has been added to the queue!`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );
    if (!serverQueue)
        return message.channel.send("There is no song that I could skip!");
    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "You have to be in a voice channel to stop the music!"
        );

    if (!serverQueue)
        return message.channel.send("There is no song that I could stop!");

    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
    const serverQueue = this.queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        this.queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            this.play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}
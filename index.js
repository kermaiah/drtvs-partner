// ============================
// ✅ index.js (Updated)
// ============================
const {
  Client,
  GatewayIntentBits,
  Collection,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
  Events
} = require('discord.js');
const fs = require('fs');
const express = require('express');
const PORT = 3000;
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

// Slash + Button Handler
client.on('interactionCreate', async interaction => {
  const interactionHandler = require('./handlers/interactionHandler');
  await interactionHandler(interaction);

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: 'There was an error executing this command.', flags: 64 });
    }
  }
});

// Ad Detection in Ticket
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const isTicket = message.channel.name?.startsWith('partner-');
  if (!isTicket) return;

  const cooldown = client.cooldowns?.get(`ad_${message.author.id}`);
  if (cooldown) return;

  const containsLink = /(https?:\/\/)?(www\.)?(discord\.gg|discord\.com\/invite)/gi.test(message.content);
  if (!containsLink) return;

  if (!client.cooldowns) client.cooldowns = new Map();
  client.cooldowns.set(`ad_${message.author.id}`, true);
  setTimeout(() => client.cooldowns.delete(`ad_${message.author.id}`), 5000);

  const { QuickDB } = require('quick.db');
  const db = new QuickDB();
  const logChannelId = await db.get('logChannel');
  const logChannel = message.guild.channels.cache.get(logChannelId);

  if (logChannel) {
    const allTickets = message.guild.channels.cache.filter(c => c.name?.startsWith('partner-'));
    const position = Array.from(allTickets.keys()).indexOf(message.channel.id) + 1;

    const embed = new EmbedBuilder()
      .setTitle(`Partner Request #${position}\n${message.author.tag} | ${message.author.id}`)
      .setDescription(`**Ad:**\n${message.content}`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() })
      .setTimestamp()
      .setColor('#FFFFFF');

    const acceptBtn = new ButtonBuilder()
      .setCustomId(`accept_${message.channel.id}_${message.author.id}`)
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success);

    const rejectBtn = new ButtonBuilder()
      .setCustomId(`reject_${message.channel.id}_${message.author.id}`)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(acceptBtn, rejectBtn);
    await logChannel.send({ embeds: [embed], components: [row] });
  }


  await message.reply({
    content: 'Your partnership ad has been submitted to staff. Please wait for approval.',
    flags: 64
  });
});

client.once('ready', () => {
  console.log(`${client.user.tag} is online.`);
});

// Keep-alive server
express().get('/', (_, res) => res.send('Bot is online')).listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});

client.login(process.env.TOKEN);

// ============================
// ✅ handlers/interactionHandler.js (Final Fixed + White Embed + Partner #)
// ============================
require('dotenv').config();
const {
  InteractionType,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const YOUR_AD = process.env.YOUR_AD;

module.exports = async (interaction) => {
  try {
    if (interaction.type === InteractionType.MessageComponent && interaction.isButton()) {
      const { customId, user, guild, client } = interaction;

      // 🎫 Create Ticket
      if (customId === 'create_ticket') {
        const existing = guild.channels.cache.find(c => c.name === `partner-${user.id}`);
        if (existing) return interaction.reply({ content: 'You already have an open ticket.', flags: 64 });

        const channel = await guild.channels.create({
          name: `partner-${user.id}`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: user.id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            },
            {
              id: client.user.id,
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
            }
          ]
        });

        await db.set(`ticket_${user.id}`, channel.id);

        await channel.send({
          content: `<@${user.id}>`,
          embeds: [
            new EmbedBuilder()
              .setTitle('Partnership Request')
              .setDescription('Please send your ad content below. The bot will detect your server link and pass it along to us for review.\n-# Make sure your server ad link is valid. Avoid Spamming.')
              .setColor('#FFFFFF')
              .setThumbnail(guild.iconURL())
              .setFooter({ text: 'derivatives', iconURL: guild.iconURL() })
              .setTimestamp()
          ]
        });


        return interaction.reply({ content: 'Ticket created!', flags: 64 });
      }

      // ✅ Accept / ❌ Reject Partnership
      if (customId.startsWith('accept_') || customId.startsWith('reject_')) {
        const [, ticketChannelId, userId] = customId.split('_');
        const ticketChannel = guild.channels.cache.get(ticketChannelId);
        const logChannelId = await db.get('logChannel');
        const publicChannelId = await db.get('publicChannel');

        const logChannel = guild.channels.cache.get(logChannelId);
        const publicChannel = guild.channels.cache.get(publicChannelId);

        if (!ticketChannel) {
          return interaction.reply({
            content: `Ticket not found. Channel: <#${ticketChannelId}>`,
            flags: 64
          });
        }

        const messages = await ticketChannel.messages.fetch({ limit: 50 });
        const adMessage = messages.find(m => m.author.id === userId && m.content.includes('discord.gg'));
        const adContent = adMessage ? adMessage.content : '*No ad found.*';

        // Determine ticket number
        const allChannels = guild.channels.cache.filter(c => c.name?.startsWith('partner-'));
        const position = Array.from(allChannels.keys()).indexOf(ticketChannelId) + 1;

        const embed = new EmbedBuilder()
          .setTitle(`Partner Request #${position}`)
          .setDescription(`**Requested by:**\n${interaction.user.tag} | ${interaction.user.id}\n\n**Ad:**\n${adContent}`)
          .setThumbnail(interaction.user.displayAvatarURL())
          .setFooter({ text: guild.name, iconURL: guild.iconURL() })
          .setTimestamp()
          .setColor('#FFFFFF');

        if (logChannel) await logChannel.send({ embeds: [embed] });

        if (customId.startsWith('accept_')) {
          // ✅ Send OUR ad to their ticket
          const formattedAd = YOUR_AD || '**[No server ad configured]**';
          await ticketChannel.send({ content: `${formattedAd}\n\nApproved. Here's our ad <@${userId}>` });

          // ✅ Send THEIR ad to the public partnership channel
          if (publicChannel && adMessage) {
            await publicChannel.send({ content: `${adMessage.content}\n\nrep: <@${userId}>` });
          }
        } else if (customId.startsWith('reject_')) {
          await ticketChannel.send({ content: `<@${userId}>, your partnership request was rejected.` });
        }

        return interaction.reply({ content: 'Action completed.', flags: 64 });
      }
    }
  } catch (err) {
    console.error('Interaction error:', err);
  }
};
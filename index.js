//import express 和 ws 套件
const express = require('express'),
  SocketServer = require('ws').Server,
  line = require('@line/bot-sdk');
if (process.env.NODE_ENV != 'production') require('dotenv').config();
const redisPromise = require('./utils/redis');

const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
  },
  client = new line.Client(config),
  PORT = process.env.PORT || 3000,
  app = express();
let BULLETS = '',
  USER_AVATAR = '',
  USER_NAME = ''; //default message

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }
  const userId = event.source.userId;
  const user = await client.getProfile(event.source.userId);
  USER_AVATAR = user.pictureUrl;
  // USER_NAME = user.displayName;
  const context = event.message.text;
  BULLETS = context;
  message = '已發送';

  const re = /(v)+\s+(one|two|three)+(\s+)(\w+)/gm;

  if (context.match(re)) {
    voteCondition = context.split(' ');
    const voteData = {
      userId,
      awardNumber: voteCondition[1],
      team: voteCondition[2],
    };
    const userData = await redisPromise.getTeamAndUpdateAwards(voteData);
    if (typeof userData === 'string') message = userData;
    else {
      await redisPromise.saveJsonToRedis('votes', userData);
      message = '投票成功';
    }
  } else if (context === 'list') {
    message = await redisPromise.getAwards();
  } else {
    let lineData = { userId: userId, avatar: USER_AVATAR, text: context };

    const userData = await redisPromise.getAndUpdateUserList(lineData);
    await redisPromise.saveJsonToRedis('users', userData);
  }
  const echo = {
    type: 'text',
    text: message,
  };
  return await client.replyMessage(event.replyToken, echo);
}

app.post('/webhooks/line', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

const server = app.listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new SocketServer({ server });

wss.on('connection', (ws) => {
  console.log(`Client connected, port is ${PORT}`);
  // Send global message to Client in the schedule.
  const sendNowTime = setInterval(() => {
    ws.send(
      JSON.stringify({
        text: BULLETS,
        avatar: USER_AVATAR,
        userName: USER_NAME,
      })
    );
    BULLETS = '';
    USER_NAME = '';
    USER_AVATAR = ''; // Refresh
  }, 2000);

  ws.on('message', (data) => ws.send(data));

  ws.on('close', () => {
    clearInterval(sendNowTime);
    console.log('Close connected');
  });
});

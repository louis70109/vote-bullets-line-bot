const redis = require('redis');
const redisClient = redis.createClient({
  host: process.env.REDIS,
  port: process.env.REDIS_PORT,
});

redisClient.on('error', (error) => {
  console.error(error);
});
const redisPromise = {};
redisPromise.getAndUpdateUserList = (lineData) => {
  return new Promise((resolve, reject) => {
    redisClient.get('users', (err, val) => {
      let userData = [];
      if (err) throw reject('Redis get error');
      if (val === '' || val === null) {
        userData.push(lineData); // if empty list
      }
      // Expect val == list of dict
      else {
        userData = JSON.parse(val);
        let userInListFlag = false;
        for (let i = 0; i < userData.length; i++) {
          if (userData[i].userId === lineData.userId) {
            userInListFlag = true;
            userData[i] = lineData;
          }
        }
        if (!userInListFlag) userData.push(lineData);
      }

      resolve(userData);
    });
  });
};

redisPromise.getTeamAndUpdateAwards = (voteData) => {
  return new Promise((resolve, reject) => {
    redisClient.get('votes', (err, val) => {
      let userData = {};
      const teamList = ['1', '2', '3'];
      if (err) throw reject('Redis get vote error');
      if (val === '' || val === null) {
        console.log('Vote list was empty, input init team data.');
        userData.award = [];
        userData.awardList = { userId: '', votes: [] };
        // implement some condition to map teamList to userData.award
        userData.award.push(
          {
            team: '1',
            awards: {
              one: 0,
              two: 0,
              three: 0,
            },
          },
          {
            team: '2',
            awards: {
              one: 0,
              two: 0,
              three: 0,
            },
          },
          {
            team: '3',
            awards: {
              one: 0,
              two: 0,
              three: 0,
            },
          }
        );
        // if empty list
        /**
         * voteData = {userId, awardNumber, team}
         */
      } else {
        userData = JSON.parse(val);
        if (teamList.indexOf(voteData.team) === -1)
          resolve('投票的隊伍錯了喔！'); // error
        else {
          // Judge vote list upper limit = 3
          let count = 0;
          for (let i = 0; i < userData.awardList.votes.length; i++) {
            if (count === 3) resolve('投票超過上限');
            if (userData.awardList.userId === voteData.userId) count += 1;
          }
          // update awardList user and they vote team
          // could vote same team three times
          userData.awardList.userId = voteData.userId;
          userData.awardList.votes.push(voteData.team);

          // update TEAM award count.
          // if found, break.
          for (let i = 0; i < userData.award.length; i++) {
            let award = userData.award[i];
            if (voteData.team === award.team) {
              award.awards[voteData.awardNumber] += 1;
              break;
            }
          }
        }
      }

      resolve(userData);
    });
  });
};

redisPromise.saveJsonToRedis = (objectName, lineData) => {
  return new Promise((resolve, reject) => {
    const setResult = redisClient.set(
      objectName,
      JSON.stringify(lineData),
      redis.print
    );
    resolve(setResult);
  });
};

module.exports = redisPromise;

// connecting to websocket
import WebSocketManager from './js/socket.js';
const socket = new WebSocketManager(window.location.host);

const defaultHp = 1000000;
const flatDamageBonus = 50000;

let isRankedState = false;

let youId = -1;
let rankedStage = -1;

let scoreChanged = false;

const isHiddenClassName = "is-hidden";

// cache values here to prevent constant updating
const cache = {
  you: {
    name: "You",
    hp: defaultHp,
    score: 0,
    combo: 0,
    accuracy: 100,
    damageMultiplier: 0.5

  },
  them: {
    name: "Them",
    hp: defaultHp,
    score: 0,
    combo: 0,
    accuracy: 100,
    damageMultiplier: 0.5
  },
  scoreDiff: 0,
  damage: 0,
  damageMultiplier: 0.5
};

const pageCounts = {
  you: {
    hp: new CountUp('you-health', 0, 0, 0, .5, { useEasing: true, useGrouping: true, separator: " " }),
    score: new CountUp('you-score', 0, 0, 0, .2, { useEasing: true, useGrouping: true, separator: "." }),
    combo: new CountUp('you-combo', 0, 0, 0, .2, { useEasing: true, separator: " ", suffix: 'x' }),
    accuracy: new CountUp('you-accuracy', 0, 0, 2, .2, { useEasing: true, separator: " ", decimal: ".", suffix: '%' }),

    hpBar: undefined,
    damageBar: undefined
  },
  them: {
    hp: new CountUp('them-health', 0, 0, 0, .5, { useEasing: true, useGrouping: true, separator: " " }),
    score: new CountUp('them-score', 0, 0, 0, .2, { useEasing: true, useGrouping: true, separator: "." }),
    combo: new CountUp('them-combo', 0, 0, 0, .2, { useEasing: true, separator: " ", suffix: 'x' }),
    accuracy: new CountUp('them-accuracy', 0, 0, 2, .2, { useEasing: true, separator: " ", decimal: ".", suffix: '%' }),

    hpBar: undefined,
    damageBar: undefined
  },
  damage: new CountUp('damage', 0, 0, 0, .2, { useEasing: true, useGrouping: true, separator: "." }),
};

let damageElement = undefined;
let youNameElement = undefined;
let themNameElement = undefined;
let everythingElement = undefined;

document.addEventListener("DOMContentLoaded", () => {
  pageCounts.you.hpBar = document.getElementById("you-hp-bar");
  pageCounts.you.damageBar = document.getElementById("you-damaged-bar");
  pageCounts.them.hpBar = document.getElementById("them-hp-bar");
  pageCounts.them.damageBar = document.getElementById("them-damaged-bar");

  damageElement = document.getElementById("damage");
  youNameElement = document.getElementById("you-name");
  themNameElement = document.getElementById("them-name");
  everythingElement = document.getElementById("everything");

  clear();

  hideElement(everythingElement);

  // receive message update from websocket
  socket.api_v2(data => {
    socketDataProcess(data);
  }, [
    'rankedPlay',
    'profile',
    'leaderboard'
  ]);
});

function clear() {
  youId = -1;
  rankedStage = -1;

  cache.you.hp = 1000000;
  cache.you.damageMultiplier = 0;

  cache.them.name = "Them";
  cache.them.hp = 1000000;
  cache.them.damageMultiplier = 0;

  pageCounts.you.hp.update(cache.you.hp);
  pageCounts.them.hp.update(cache.them.hp);

  if (pageCounts.you.hpBar) {
    pageCounts.you.hpBar.style.width = "100%";
  }
  if (pageCounts.them.hpBar) {
    pageCounts.them.hpBar.style.width = "100%";
  }
  if (pageCounts.you.damageBar) {
    pageCounts.you.damageBar.style.width = "0%";
    pageCounts.you.damageBar.style["margin-right"] = "0%";
  }
  if (pageCounts.them.damageBar) {
    pageCounts.them.damageBar.style.width = "0%";
    pageCounts.them.damageBar.style["margin-left"] = "0%";
  }

  smallClean();
}

function smallClean() {

  cache.scoreDiff = 0;

  cache.you.accuracy = 100;
  cache.you.combo = 0;
  cache.you.score = 0;
  cache.you.damageMultiplier = 0.5;

  cache.them.accuracy = 100;
  cache.them.combo = 0;
  cache.them.score = 0;
  cache.them.damageMultiplier = 0.5;

  cache.damage = 0;
  cache.damageMultiplier = 0.5;

  pageCounts.you.score.update(cache.you.score);
  pageCounts.you.combo.update(cache.you.combo);
  pageCounts.you.accuracy.update(cache.you.accuracy);

  pageCounts.damage.update(cache.damage);

  pageCounts.them.score.update(cache.them.score);
  pageCounts.them.combo.update(cache.them.combo);
  pageCounts.them.accuracy.update(cache.them.accuracy);

  if (damageElement) {
    damageElement.classList.remove('positive', 'negative');
  }

  if (pageCounts.you.damageBar) {
    pageCounts.you.damageBar.style.width = "0%";
  }
  if (pageCounts.them.damageBar) {
    pageCounts.them.damageBar.style.width = "0%";
  }
}

/**
   * @param {object} leaderboard
   * @param {'left' | 'right'} side
   */
function updateThings(cache, socketData, pageData, leaderboard, side) {

  if (cache.hp !== socketData.life) {
    cache.hp = socketData.life;
    pageData.hp.update(cache.hp);

    const healthPercent = cache.hp / defaultHp * 100;
    pageData.hpBar.style.width = `${healthPercent}%`;

    const margin = side === 'right' ? "margin-left" : "margin-right";

    pageData.damageBar.style[margin] = `${100 - healthPercent}%`;
  }

  if (cache.score !== leaderboard.score) {
    cache.score = leaderboard.score;
    pageData.score.update(cache.score);

    scoreChanged = true;
  }
  if (cache.accuracy !== leaderboard.accuracy) {
    cache.accuracy = leaderboard.accuracy;
    pageData.accuracy.update(cache.accuracy);
  }
  if (cache.combo !== leaderboard.combo) {
    cache.combo = leaderboard.combo.current;
    pageData.combo.update(cache.combo);
  }
}

/**
   * @param {number} scoreDiff
   * @param {number} globalDamageMultiplier
   * @param {number} userDamageMultiplier
   */
function calculateDamage(scoreDiff, globalDamageMultiplier, userDamageMultiplier) {
  return scoreDiff * (globalDamageMultiplier + userDamageMultiplier) + flatDamageBonus;
}

function hideElement(element) {
  if (element.classList.contains(isHiddenClassName)) {
    return;
  }
  element.classList.add(isHiddenClassName);
}
function unHideElement(element) {
  if (!element.classList.contains(isHiddenClassName)) {
    return;
  }
  element.classList.remove(isHiddenClassName);
}

/**
   * @param {import('./js/socket.js').WEBSOCKET_V2} data
   */
function socketDataProcess(data) {
  try {

    if (!data.rankedPlay) {

      if (!isRankedState)
        return;

      if (everythingElement) {
        hideElement(everythingElement);
      }

      clear();
      isRankedState = false;
      return;
    }

    if (youId === -1) {
      youId = data.profile.id;
    }

    // по идее рано это всё всасывать ну да похуй

    const you = data.rankedPlay.users.filter(u => u.id === youId)[0];
    if (!you) {
      return;
    }
    const them = data.rankedPlay.users.filter(u => u.id !== youId)[0];

    cache.you.damageMultiplier = you.info.damageMultiplier;
    cache.them.damageMultiplier = them.info.damageMultiplier;
    cache.damageMultiplier = data.rankedPlay.damageMultiplier;

    if (!isRankedState) {
      isRankedState = true;

      cache.you.name = youBoard.name;
      cache.them.name = themBoard.name;

      youNameElement.textContent = cache.you.name;
      themNameElement.textContent = cache.them.name;

      unHideElement(everythingElement);
    }

    if (data.rankedPlay.stage !== rankedStage) {
      rankedStage = data.rankedPlay.stage;

      if (rankedStage === 7) {
        unHideElement(everythingElement);
      }
      else {
        hideElement(everythingElement);
        smallClean();
      }
    }

    const youBoard = data.leaderboard.filter(l => l.id === you.id)[0];
    const themBoard = data.leaderboard.filter(l => l.id === them.id)[0];
    if (!youBoard || !themBoard) {
      return;
    }

    // 7 = gameplay
    if (rankedStage === 7) {

      updateThings(cache.you, you.info, pageCounts.you, youBoard, 'left');
      updateThings(cache.them, them.info, pageCounts.them, themBoard, 'right');

      if (scoreChanged) {

        const newScoreDiff = cache.you.score - cache.them.score;

        if (newScoreDiff !== cache.scoreDiff) {

          console.log(`${newScoreDiff} ${cache.damageMultiplier} ${newScoreDiff > 0 ? cache.you.damageMultiplier : cache.them.damageMultiplier}`)
          const damage = newScoreDiff === 0 ? 0 :
            calculateDamage(Math.abs(newScoreDiff), cache.damageMultiplier, newScoreDiff > 0 ? cache.you.damageMultiplier : cache.them.damageMultiplier);

          if (newScoreDiff === 0) {
            if (cache.scoreDiff !== 0) {
              damageElement.classList.remove('positive', 'negative');
              pageCounts.you.damageBar.style.width = "0%";
              pageCounts.them.damageBar.style.width = "0%";
            }
          }
          else if (newScoreDiff > 0) {
            if (cache.scoreDiff <= 0) {
              damageElement.classList.remove('negative');
              damageElement.classList.add('positive');
              pageCounts.you.damageBar.style.width = "0%";
            }

            const percent = damage / defaultHp * 100;
            pageCounts.them.damageBar.style.width = `${percent}%`;
          }
          else {
            if (cache.scoreDiff >= 0) {
              damageElement.classList.remove('positive');
              damageElement.classList.add('negative');
              pageCounts.them.damageBar.style.width = "0%";
            }

            const percent = damage / defaultHp * 100;
            pageCounts.you.damageBar.style.width = `${percent}%`;
          }

          pageCounts.damage.update(damage);
          cache.scoreDiff = newScoreDiff;
        }

        scoreChanged = false;
      }
    }
  } catch (error) {
    console.log(error);
  };
}
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')

const { GoalNear, GoalFollow } = goals

const CONFIG = {
  host: process.env.MC_HOST || 'MrSadib.aternos.me',
  port: Number(process.env.MC_PORT || 54276),
  username: process.env.BOT_USERNAME || 'MyBot',
  auth: process.env.MC_AUTH || 'offline',
  version: '1.21.11',

  reconnectDelay: 10000,
  activityInterval: 30000
}

let bot = null
let activityTimer = null
let reconnectTimer = null
let shuttingDown = false

function createBot() {
  console.log('-----------------------------------')
  console.log('Starting Minecraft bot...')
  console.log(`Server: ${CONFIG.host}:${CONFIG.port}`)
  console.log(`Version: ${CONFIG.version}`)
  console.log(`Username: ${CONFIG.username}`)
  console.log('-----------------------------------')

  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    auth: CONFIG.auth,
    version: CONFIG.version
  })

  bot.loadPlugin(pathfinder)

  bot.once('spawn', () => {
    console.log('Bot joined the server!')

    const movements = new Movements(bot)

    movements.canDig = false

    bot.pathfinder.setMovements(movements)

    startActivities()

    setTimeout(() => {
      safeLookAround()
    }, 3000)
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username) return

    const command = message.trim().toLowerCase()

    if (command === '!help') {
      bot.chat('Commands: !come !follow !stop !where !jump !look')
      return
    }

    if (command === '!come') {
      const player = bot.players[username]

      if (!player || !player.entity) {
        bot.chat("I can't see you.")
        return
      }

      const pos = player.entity.position

      bot.pathfinder.setGoal(
        new GoalNear(pos.x, pos.y, pos.z, 2)
      )

      bot.chat('Coming!')
      return
    }

    if (command === '!follow') {
      const player = bot.players[username]

      if (!player || !player.entity) {
        bot.chat("I can't see you.")
        return
      }

      bot.pathfinder.setGoal(
        new GoalFollow(player.entity, 2),
        true
      )

      bot.chat(`Following ${username}.`)
      return
    }

    if (command === '!stop') {
      bot.pathfinder.setGoal(null)
      bot.clearControlStates()
      bot.chat('Stopped.')
      return
    }

    if (command === '!where') {
      if (!bot.entity) return

      const p = bot.entity.position

      bot.chat(
        `X:${Math.floor(p.x)} Y:${Math.floor(p.y)} Z:${Math.floor(p.z)}`
      )

      return
    }

    if (command === '!jump') {
      jump()
      return
    }

    if (command === '!look') {
      safeLookAround()
      return
    }
  })

  bot.on('health', () => {
    if (!bot.entity) return

    if (bot.health <= 5) {
      console.log(`Low health: ${bot.health}`)
    }
  })

  bot.on('death', () => {
    console.log('Bot died.')

    stopMovement()

    setTimeout(() => {
      if (bot && bot.entity) {
        safeLookAround()
      }
    }, 5000)
  })

  bot.on('kicked', reason => {
    console.log('Bot was kicked:')
    console.log(reason)
  })

  bot.on('error', error => {
    console.log('Minecraft error:')
    console.log(error.message)
  })

  bot.on('end', () => {
    console.log('Bot disconnected.')

    stopActivities()

    if (!shuttingDown) {
      scheduleReconnect()
    }
  })
}

function startActivities() {
  stopActivities()

  activityTimer = setInterval(() => {
    if (!bot || !bot.entity) return

    if (bot.pathfinder.isMoving()) return

    const action = Math.floor(Math.random() * 4)

    if (action === 0) {
      randomWalk()
    }

    if (action === 1) {
      safeLookAround()
    }

    if (action === 2) {
      jump()
    }

    if (action === 3) {
      randomWalk()
    }
  }, CONFIG.activityInterval)
}

function randomWalk() {
  if (!bot || !bot.entity) return

  const current = bot.entity.position

  const distance = 5 + Math.floor(Math.random() * 10)

  const angle = Math.random() * Math.PI * 2

  const x = current.x + Math.cos(angle) * distance
  const z = current.z + Math.sin(angle) * distance
  const y = current.y

  console.log(
    `Walking toward ${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)}`
  )

  bot.pathfinder.setGoal(
    new GoalNear(
      Math.floor(x),
      Math.floor(y),
      Math.floor(z),
      2
    )
  )
}

function jump() {
  if (!bot || !bot.entity) return

  bot.setControlState('jump', true)

  setTimeout(() => {
    if (bot) {
      bot.setControlState('jump', false)
    }
  }, 400)
}

async function safeLookAround() {
  if (!bot || !bot.entity) return

  try {
    const yaw = Math.random() * Math.PI * 2
    const pitch = (Math.random() - 0.5) * 0.5

    await bot.look(yaw, pitch, true)
  } catch (error) {
    console.log('Look error:', error.message)
  }
}

function stopMovement() {
  if (!bot) return

  try {
    bot.pathfinder.setGoal(null)
    bot.clearControlStates()
  } catch (error) {
    console.log('Movement stop error:', error.message)
  }
}

function stopActivities() {
  if (activityTimer) {
    clearInterval(activityTimer)
    activityTimer = null
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return

  console.log(
    `Reconnecting in ${CONFIG.reconnectDelay / 1000} seconds...`
  )

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null

    if (!shuttingDown) {
      createBot()
    }
  }, CONFIG.reconnectDelay)
}

function shutdown() {
  shuttingDown = true

  console.log('Shutting down bot...')

  stopActivities()

  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
  }

  if (bot) {
    try {
      bot.quit('Bot shutting down')
    } catch {}
  }

  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

createBot()

import { app } from './app.js'
import { config } from './config.js'

app.listen(config.port, () => {
  console.log(`API mealplanner en ecoute sur le port ${config.port}`)
})

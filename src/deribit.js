import Deribit from 'deribit-ws-js'

export default new Deribit({
  key: process.env.VUE_APP_DERIBIT_KEY,
  secret: process.env.VUE_APP_DERIBIT_SECRET,
})

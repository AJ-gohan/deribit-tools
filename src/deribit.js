import Deribit from 'deribit-ws-js'

import store from './store'

let deribit = new Deribit({
  key: process.env.VUE_APP_DERIBIT_KEY,
  secret: process.env.VUE_APP_DERIBIT_SECRET,
})

deribit.connected.then(() => {
  deribit.hook('order_book', 'index', msg => {
    if (msg.edp && msg.btc) {
      store.commit('index', { symbol: 'BTC', ind: msg.btc })
      return
    }

    if (!msg.instrument) {
      console.error('Missing instrument', msg)
      return
    }

    if (['C', 'P'].includes(msg.instrument.substring(msg.instrument.length - 1))) {
      store.commit('orderBookOption', msg)
    } else {
      store.commit('orderBookFuture', msg)
    }
  })
})

export default deribit

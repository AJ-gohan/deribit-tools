import store from './store'
import deribit from './deribit'

function trade(cont) {
  let action = cont > 0 ? 'buy' : 'sell'

  return deribit.action(action, {
    instrument: 'BTC-PERPETUAL',
    type: 'market',
    quantity: Math.abs(cont),
  })
}

class DeltaHedge {
  contracts(delta, price) {
    return Math.round((delta * price) / 10)
  }

  start() {
    // Delta hedge
    setInterval(() => {
      if (store.state.readyState < 4) return

      let { active, type } = store.state.dh
      if (!active) return

      // Check negative delta

      let currPrice = store.getters.price()
      let currDelta = store.getters.delta()
      let currFutureDelta = store.getters.delta('PERPETUAL', 'future')

      if (type === 'hedge') {
        let {
          hedge_limit_up,
          hedge_limit_down,
          hedge_step_up,
          hedge_step_down,
        } = store.state.dh

        if (currDelta > hedge_limit_up + hedge_step_up) {
          let diff = currDelta - hedge_limit_up
          let cont = this.contracts(-diff, currPrice)
          trade(cont).catch(console.log)
        }

        if (currDelta < hedge_limit_down - hedge_step_down) {
          let diff = currDelta - hedge_limit_down
          let cont = this.contracts(-diff, currPrice)
          trade(cont).catch(console.log)
        }
      }

      if (type === 'builder') {
        let { builder_delta, builder_price, builder_zero, builder_step } = store.state.dh
        let initSteps = Math.round(Math.abs(builder_price - builder_zero) / builder_step)
        let deltaStep = builder_delta / initSteps

        let priceDiff = currPrice - builder_price

        let madeSteps =
          priceDiff > 0
            ? Math.floor(priceDiff / builder_step)
            : Math.ceil(priceDiff / builder_step)

        let deltaChange = deltaStep * madeSteps
        deltaChange = builder_price > builder_zero ? deltaChange : -deltaChange

        let newDelta = deltaChange + builder_delta

        // Check overdose
        newDelta = builder_delta > 0 ? Math.max(newDelta, 0) : Math.min(newDelta, 0)

        let diff = newDelta - currDelta
        let cont = this.contracts(diff, currPrice)

        if (
          (builder_delta > 0 && currFutureDelta < 0) ||
          (builder_delta < 0 && currFutureDelta > 0)
        ) {
          if (Math.abs(diff) > Math.abs(deltaStep)) {
            trade(cont).catch(console.log)
          }
        }
      }
    }, 3000)
  }
}

export default new DeltaHedge()

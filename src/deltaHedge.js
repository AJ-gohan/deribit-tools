import store from './store'

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

      if (type === 'hedge') {
        let { hedge_target, hedge_up, hedge_down } = store.state.dh

        let diff = currDelta - hedge_target
        let cont = this.contracts(diff, currPrice)

        if (diff > 0 && diff > +hedge_up) {
          console.log('removing ', -diff, -cont)
        }

        if (diff < 0 && Math.abs(diff) > +hedge_down) {
          console.log('adding ', -diff, -cont)
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

        let newDelta = deltaStep * madeSteps + builder_delta

        // Check overdose

        newDelta = builder_delta > 0 ? Math.max(newDelta, 0) : Math.min(newDelta, 0)

        let diff = newDelta - currDelta
        let cont = this.contracts(diff, currPrice)

        if (Math.abs(diff) > Math.abs(deltaStep)) {
          console.log('Hedging', {
            currPrice,
            currDelta,
            initSteps,
            deltaStep,
            priceDiff,
            madeSteps,
            newDelta,
            diff,
            cont,
          })
        }
      }
    }, 3000)
  }
}

export default new DeltaHedge()

import Vue from 'vue'
import Vuex from 'vuex'
import deribit from './deribit'
import _ from 'lodash/fp'
import moment from 'moment'
import Promise from 'bluebird'
import { Object } from 'core-js'
import greeks from 'greeks'

Vue.use(Vuex)

const Fee = {
  BTC: 0.0005,
}

export default new Vuex.Store({
  state: {
    positions: [],
    symbol: {},
    readyState: 0,
    dh: {
      active: false,
      target: localStorage.delta_target || 0,
      up: localStorage.delta_up || 0,
      down: localStorage.delta_down || 0,
    },
  },
  getters: {
    expirations: state => (all = false, symbol = 'BTC') => {
      if (!state.symbol[symbol]) {
        return []
      }

      if (all) {
        return _.flow(
          _.map(_.pick(['code', 'days'])),
          _.sortBy('days'),
          _.map('code'),
        )(state.symbol[symbol].opt)
      } else {
        return _.flow(
          _.map(_.pick(['code', 'days', 'state'])),
          _.filter(o => o.state === 'open' || o.state === null),
          _.sortBy('days'),
          _.map('code'),
        )(state.symbol[symbol].opt)
      }
    },
    strikes: state => (exp, symbol = 'BTC') => {
      if (!state.symbol[symbol] || !state.symbol[symbol].opt[exp]) {
        return []
      }

      return _.flow(
        Object.keys,
        _.map(Number),
        _.sortBy(Number),
      )(state.symbol[symbol].opt[exp].strike)
    },
    symbols: state => () => {
      return Object.keys(state.symbol)
    },
    futureCode: state => (exp, symbol = 'BTC') => {
      if (state.symbol[symbol].fut[exp]) {
        return exp
      }

      return _.flow(
        _.map(_.pick(['days', 'code'])),
        _.sortBy('days'),
        _.last,
        _.get('code'),
      )(state.symbol[symbol].fut)
    },
    positions: state => (exp, kind = 'option', symbol = 'BTC') => {
      if (!exp) {
        return state.positions.filter(one => one.kind == kind)
      }

      return state.positions.filter(
        one => one.instrument.includes(exp) && one.kind == kind,
      )
    },
    futurePrice: (state, getters) => (exp, symbol = 'BTC') => {
      return state.symbol[symbol].fut[getters.futureCode(exp, symbol)].mid
    },
    ATM: (state, getters) => (exp, symbol = 'BTC') => {
      let chain = state.symbol[symbol].opt[exp]
      let price = getters.futurePrice(exp, symbol)

      return _.flow(
        _.sortBy(strike => Math.abs(strike - price)),
        _.head,
        Number,
      )(Object.keys(chain.strike))
    },
    ATMIV: (state, getters) => (exp, symbol = 'BTC') => {
      let chain = state.symbol[symbol].opt[exp]
      return chain.strike[getters.ATM(exp, symbol)].midIV
    },
    straddle: (state, getters) => (exp, bidask = 'ask', symbol = 'BTC') => {
      if (!getters.expirations().includes(exp)) {
        throw new Error(`Unkown expiration - ${exp}`)
      }

      let chain = state.symbol[symbol].opt[exp]
      let price = getters.futurePrice(exp, symbol)
      let atmStrike = getters.ATM(exp, symbol)

      let type = atmStrike >= price ? 'call' : 'put'

      let atmPrice = chain.strike[atmStrike][type][bidask]
      let atmDiff = Math.abs(atmStrike - price)
      let fee = 2 * Fee[symbol]
      fee = bidask === 'bid' ? -fee : fee
      return 2 * atmPrice * price + atmDiff + fee * price
    },
    delta: (state, getters) => (exp, kind = 'all', symbol = 'BTC') => {
      if (state.readyState < 4) return null

      let posOptions
      let posFutures

      if (exp === 'all' || !exp) {
        posOptions = ['all', 'option'].includes(kind) ? getters.positions() : []
        posFutures = ['all', 'future'].includes(kind)
          ? getters.positions(null, 'future')
          : []
      } else {
        posOptions = ['all', 'option'].includes(kind) ? getters.positions(exp) : []
        posFutures = ['all', 'future'].includes(kind)
          ? getters.positions(exp, 'future')
          : []
      }

      let deltaOptions = _.flow(
        _.filter(p => p.instrument.includes(symbol)),
        _.map(position => {
          let t = position.instrument.split('-')
          let type = t[3] === 'C' ? 'call' : 'put'
          return state.symbol[symbol].opt[t[1]].strike[t[2]][type].d * position.size
        }),
        _.sum,
      )(posOptions)

      let deltaFutures = _.flow(
        _.filter(p => p.instrument.includes(symbol)),
        _.map(position => {
          let t = position.instrument.split('-')
          let tmpExp = t[1]
          let price = getters.futurePrice(tmpExp)

          return (position.size * 10) / price
        }),
        _.sum,
      )(posFutures)

      return deltaOptions + deltaFutures
    },
  },
  mutations: {
    ready(state, level) {
      if (level > state.readyState) {
        state.readyState = level
      }
    },
    deltaHedge(state, dh) {
      localStorage.delta_target = dh.target
      localStorage.delta_up = dh.up
      localStorage.delta_down = dh.down

      state.dh = dh
    },
    getinstruments(state, r) {
      _.flow(
        _.map('baseCurrency'),
        _.uniq,
        _.map(curr => {
          if (!state.symbol[curr]) {
            Vue.set(state.symbol, curr, { fut: {}, opt: {}, ind: 0 })
          }
        }),
      )(r)

      // Futures

      _.map(symbol => {
        _.flow(
          _.filter({
            kind: 'future',
            baseCurrency: symbol,
            currency: 'USD',
          }),
          _.map(
            _.flow(
              _.get('instrumentName'),
              _.split('-'),
              _.nth(1),
            ),
          ),
          _.map(exp => {
            let dt = moment(`${exp} 09:00Z`, 'DDMMMYY HH:mmZ')

            if (!state.symbol[symbol].fut[exp]) {
              Vue.set(state.symbol[symbol].fut, exp, {
                code: exp,
                date: dt.toDate(),
                days: moment.duration(dt.diff(moment())).as('days'),
                state: null,
                bid: null,
                ask: null,
                mid: null,
              })
            }
          }),
        )(r)
      })(Object.keys(state.symbol))

      // Options

      _.map(symbol => {
        _.flow(
          _.filter({
            kind: 'option',
            baseCurrency: symbol,
            currency: 'USD',
          }),
          _.map(
            _.flow(
              _.get('instrumentName'),
              _.split('-'),
              _.nth(1),
            ),
          ),
          _.uniq,
          _.map(exp => {
            // Expirations

            let dt = moment(`${exp} 09:00Z`, 'DDMMMYY HH:mmZ')

            if (!state.symbol[symbol].opt[exp]) {
              Vue.set(state.symbol[symbol].opt, exp, {
                code: exp,
                date: dt.toDate(),
                days: moment.duration(dt.diff(moment())).as('days'),
                state: null,
                IV: null,
                ATM: null,
                range: { bid: null, ask: null },
                strike: {},
              })
            }

            // Strikes

            let expAddr = state.symbol[symbol].opt[exp].strike

            _.flow(
              _.filter({
                kind: 'option',
                baseCurrency: symbol,
                currency: 'USD',
              }),
              _.filter(e => _.includes(exp, e.instrumentName)),
              _.map('strike'),
              _.uniq,
              _.map(strike => {
                if (expAddr[strike]) {
                  return
                }

                Vue.set(expAddr, strike, {
                  strike,
                  bidIV: null,
                  askIV: null,
                  midIV: null,
                  spreadIV: null,
                  call: {
                    bid: null,
                    ask: null,
                    mid: null,
                    bidIV: null,
                    askIV: null,
                    midIV: null,
                    settlement: null,
                    d: null,
                    g: null,
                    v: null,
                    t: null,
                  },
                  put: {
                    bid: null,
                    ask: null,
                    mid: null,
                    bidIV: null,
                    askIV: null,
                    midIV: null,
                    settlement: null,
                    d: null,
                    g: null,
                    v: null,
                    t: null,
                  },
                })
              }),
            )(r)
          }),
        )(r)
      })(Object.keys(state.symbol))
    },
    greeks: (state, { symbol, prices }) => {
      Object.keys(state.symbol[symbol].opt).forEach(exp => {
        Object.keys(state.symbol[symbol].opt[exp].strike).forEach(strike => {
          let price = prices[exp]
          let addr = state.symbol[symbol].opt[exp].strike[strike]
          let time = state.symbol[symbol].opt[exp].days / 365
          let iv = state.symbol[symbol].opt[exp].strike[strike].midIV / 100

          addr.call.d = greeks.getDelta(price, strike, time, iv, 0, 'call')
          addr.put.d = greeks.getDelta(price, strike, time, iv, 0, 'put')

          addr.call.t = greeks.getTheta(price, strike, time, iv, 0, 'call')
          addr.put.t = greeks.getTheta(price, strike, time, iv, 0, 'put')

          addr.call.g = addr.put.g = greeks.getGamma(price, strike, time, iv, 0)
          addr.call.v = addr.put.v = greeks.getVega(price, strike, time, iv, 0)
        })
      })
    },
    orderBookOption(state, r) {
      let addr = state.symbol

      let [symbol, exp, strikeStr, type] = r.instrument.split('-')
      let t = type === 'C' ? 'call' : 'put'

      if (!addr[symbol].opt[exp].strike['' + strikeStr]) {
        return
      }

      let strike = addr[symbol].opt[exp].strike['' + strikeStr]
      let option = addr[symbol].opt[exp].strike['' + strikeStr][t]

      option.bid = r.bids[0] && r.bids[0].price ? r.bids[0].price : null
      option.ask = r.asks[0] && r.asks[0].price ? r.asks[0].price : null
      option.mid = (option.bid + option.ask) / 2

      option.bids = r.bids
      option.asks = r.asks

      option.bidIV = r.bidIv
      option.askIV = r.askIv
      option.midIV = (r.bidIv + r.askIv) / 2

      strike.state = r.state
      option.settlement = r.settlementPrice
    },
    orderBookFuture(state, r) {
      let addr = state.symbol
      let [symbol, exp] = r.instrument.split('-')

      if (!addr[symbol].fut[exp]) {
        return
      }

      let i = addr[symbol].fut[exp]
      i.state = r.state
      i.bid = r.bids[0].price || null
      i.ask = r.asks[0].price || null
      i.mid = i.bid && i.ask ? (i.bid + i.ask) / 2 : i.bid
    },
    index(state, { symbol, ind }) {
      state.symbol[symbol].ind = ind
    },
    positions(state, positions) {
      state.positions = []

      positions.forEach(one => {
        if (one.kind === 'option') {
          state.positions.push({
            size: one.size,
            instrument: one.instrument,
            kind: one.kind,
            avg: one.averagePrice,
            avgUSD: one.averageUsdPrice,
            pnl: one.floatingPl,
            pnlUSD: one.floatingUsdPl,
            td: one.delta,
          })
        }

        if (one.kind === 'future') {
          state.positions.push({
            size: one.size,
            instrument: one.instrument,
            kind: one.kind,
            avg: one.averagePrice,
            avgUSD: one.averagePrice,
            pnl: one.profitLoss,
            pnlUSD: one.floatingUsdPl,
            td: one.delta,
          })
        }
      })
    },
    updExp(state, { exp, price, symbol = 'BTC' }) {
      let expObj = state.symbol[symbol].opt[exp]
      let strikes = Object.keys(expObj.strike)

      strikes.forEach(strike => {
        let option =
          +strike >= price ? expObj.strike[strike].call : expObj.strike[strike].put

        let strObj = expObj.strike[strike]

        strObj.bidIV = option.bidIV
        strObj.askIV = option.askIV
        strObj.midIV = option.midIV

        strObj.spreadIV = Math.abs(strObj.bidIV - strObj.askIV)
      })

      expObj.days = moment.duration(moment(expObj.date).diff(moment())).as('days')
    },
    updExpATM(state, { exp, ATM, symbol = 'BTC' }) {
      state.symbol[symbol].opt[exp].ATM = ATM
    },
    updExpIV(state, { exp, IV, symbol = 'BTC' }) {
      state.symbol[symbol].opt[exp].IV = IV
    },
    updExpRange(state, { exp, bid, ask, symbol = 'BTC' }) {
      state.symbol[symbol].opt[exp].range = { bid, ask }
    },
  },
  actions: {
    positions({ commit }) {
      return deribit.action('positions').then(p => commit('positions', p))
    },
    getinstruments({ dispatch, commit, getters }) {
      return deribit
        .action('getinstruments')
        .then(r => commit('getinstruments', r))
        .then(() => {
          let all = []

          getters.symbols().forEach(symbol => {
            getters.expirations(false, symbol).forEach(exp => {
              all.push(dispatch('initExp', { exp, symbol }))
            })
          })

          return Promise.all(all)
        })
    },
    async initExp({ dispatch, state, commit, getters }, { exp, symbol = 'BTC' }) {
      let futCode = getters.futureCode(exp, symbol)

      await deribit
        .action('getorderbook', { instrument: `${symbol}-${futCode}` })
        .then(r => commit('orderBookFuture', r))

      let strikes = Object.keys(state.symbol[symbol].opt[exp].strike)

      return Promise.map(strikes, strike => {
        return Promise.all([
          deribit
            .action('getorderbook', {
              instrument: `${symbol}-${exp}-${strike}-C`,
            })
            .then(r => commit('orderBookOption', r)),
          deribit
            .action('getorderbook', {
              instrument: `${symbol}-${exp}-${strike}-P`,
            })
            .then(r => commit('orderBookOption', r)),
        ])
      }).then(() => {
        dispatch('updExp', { exp, symbol })
      })
    },
    greeks({ state, commit, getters }) {
      Object.keys(state.symbol).forEach(symbol => {
        let prices = {}

        Object.keys(state.symbol[symbol].opt).forEach(
          exp => (prices[exp] = getters.futurePrice(exp)),
        )

        commit('greeks', { symbol, prices })
      })
      commit('ready', 4)
    },
    updExp({ commit, getters }, { exp, symbol = 'BTC' }) {
      commit('updExp', { exp, price: getters.futurePrice(exp), symbol })
      commit('updExpATM', { exp, symbol, ATM: getters.ATM(exp, symbol) })
      commit('updExpIV', { exp, symbol, IV: getters.ATMIV(exp, symbol) })
      commit('updExpRange', {
        exp,
        symbol,
        bid: getters.straddle(exp, 'bid', symbol),
        ask: getters.straddle(exp, 'ask', symbol),
      })
    },
  },
})

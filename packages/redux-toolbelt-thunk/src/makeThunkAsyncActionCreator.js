import makeAsyncActionCreator from '../../redux-toolbelt/src/makeAsyncActionCreator'
import { getOptions } from '../../redux-toolbelt/src/utils'
import _trivialArgsMapper from '../../redux-toolbelt/src/_trivialArgsMapper'
import defaultOptions from '../../redux-toolbelt/src/_defaultActionCreatorOptions'

const EMPTY_ARRAY = []
const EMPTY_OBJECT = {}
const actionCounter = {}

/**
 * Create an async action creator that relies on redux-thunk
 *
 * @typedef {function(*, *): {type: string, payload: object, meta: object}} thunkAsyncActionCreator
 * @property {string} TYPE - action type
 *
 * @param {string} baseName base name of the Action
 * @param {function} asyncFn the async function executed by the thunk
 * @param {function(*): {payload: object, meta?: object}} [argsMapper]
 * @param {object} [options]
 * @param {string} [options.prefix] prefix all action names
 * @param {object} [options.defaultMeta] default metadata for all actions
 * @param {object} [options.cancelPreviousRequests] cancel previous requests
 *
 * @returns {thunkAsyncActionCreator}
 */
export default function makeThunkAsyncActionCreator(baseName, asyncFn, argsMapper, options) {
  options = getOptions({ argsMapper, options, defaultOptions })
  argsMapper = options.argsMapper

  const actionCreator = makeAsyncActionCreator(baseName, _trivialArgsMapper, options)

  const thunkActionCreator = (...asyncFnArgs) => (...thunkArgs) => {
    const [dispatch, getState, extraThunkArg] = (thunkArgs || EMPTY_ARRAY)

    const { payload, meta: origMeta = EMPTY_OBJECT } = argsMapper(...asyncFnArgs)

    const meta = { ...origMeta, _toolbeltAsyncFnArgs: asyncFnArgs }

    const currentCounter = actionCounter[baseName] ? actionCounter[baseName] + 1 : 1
    actionCounter[baseName] = currentCounter

    dispatch(actionCreator(payload, meta))
    return Promise.resolve()
      .then(() => asyncFn(...asyncFnArgs, {getState, dispatch, extraThunkArg}))
      .then(data => {
        if(options.cancelPreviousRequests && actionCounter[baseName] !== currentCounter){
          return
        }
        return Promise.resolve(dispatch(actionCreator.success(data, meta)))
          .then(() => {
            actionCounter[baseName] = 0
            return data
          })
      })
      .catch(err => {
        return Promise.resolve(dispatch(actionCreator.failure(err, meta)))
          .then(() => {
            actionCounter[baseName] = 0
            return Promise.reject(err)
          })
      })
  }

  Object.keys(actionCreator).forEach(key => (thunkActionCreator[key] = actionCreator[key]))

  return thunkActionCreator
}


makeThunkAsyncActionCreator.withDefaults = userOptions => (baseName, asyncFn, options) => {
  options = Object.assign({}, userOptions, options)
  return makeThunkAsyncActionCreator(baseName, asyncFn, options)
}

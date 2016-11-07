var merge = require('extend');
var async = require('async');
var isBrowser = require('is-browser');
var Component = require('./component');
var Loader = require('./loader');
var $ = require('cheerio-or-jquery');

if (isBrowser) {
    window['module'] = {};
}

module.exports = (function () {

    var map = {
        'component': Component
    };

    var prototypeFactories = {};

    /**
     *
     * @param parent
     * @param name
     * @param protoFactory
     * @returns {Function}
     */
    var extend = function (parent, name, protoFactory) {

        prototypeFactories[name] = {
            parent: parent,
            factory: protoFactory
        };

        triggerComponentCallbacks(name);

    };

    var componentsLoadCallbacks = {};

    var addComponentLoadCallback = function (name, cb) {
        componentsLoadCallbacks[name] = componentsLoadCallbacks[name] || [];
        componentsLoadCallbacks[name].push(cb);
    };

    var triggerComponentCallbacks = function (name) {
        var callbacks = componentsLoadCallbacks[name];
        if (callbacks === undefined) {
            return;
        }

        get(name, function componentFound(Component) {
            var i = 0, l = callbacks.length;
            for (; i < l; i++) {
                callbacks[i].call(Component, Component);
            }
            callbacks.length = 0;
        })
    };

    var get = function (name, cb) {

        if (typeof name === 'undefined') {
            throw new Error('component name must be defined');
        }

        if (typeof map[name] !== 'undefined') {
            async.setImmediate(function componentAlreadyLoaded() {
                cb.call(map[name], map[name]);
            });
        } else if (typeof prototypeFactories[name] !== 'undefined') {

            get(prototypeFactories[name].parent, function parentComponentFound(Parent) {

                var Component = function () {
                    this.type = name;
                };

                Component.prototype = merge(
                    {},
                    Parent.prototype,
                    prototypeFactories[name].factory(Parent.prototype)
                );

                map[name] = Component;

                cb.call(map[name], map[name]);
            });

        } else {

            addComponentLoadCallback(name, cb);

            if (typeof componentsLoadCallbacks[name] === 'undefined') {
                var filename = '/components/' + name + '/component.js';
                if (isBrowser) {
                    load.js(filename);
                } else {
                    require('../..' + filename);
                }
            }
        }
    };


    var create = function (name, settings, callback) {

        if (typeof settings === 'function') {
            callback = settings;
        }

        if (typeof callback === 'undefined') {
            throw new Error('callback is mandatory');
        }

        get(name, function componentFound(Component) {
            var c = new Component();
            c.context = settings.context;

            if (typeof settings.options === "undefined") {
                settings.options = c.getDefaultOptions();
                settings.options.type = name;
            } else {
                settings.options = merge({}, c.getDefaultOptions(), settings.options);
                if (typeof settings.options.type === 'undefined') {
                    settings.options.type = name;
                }
            }
            c.init(function componentInited() {
                c.setOptions(settings.options, function optionsHaveBeenSet() {
                    c.setValue(settings.value || c.getDefaultValue(), function valueHasBeenSet() {
                        callback.call(c, c);
                    });
                });
            });
        });

    };

    var wakeUp = function (el, context, cb) {
        var data = $(el).data();
        get(data.type, function componentFound(Component) {
            var componentInstance = new Component();
            componentInstance.wakeUp(el, context, function componentHasWokenUp() { // todo maybe pass callback directly
                cb.call(null, componentInstance);
            });
        });
    };

    var getLoadedComponents = function () {
        var list = [], id;
        for (id in map) {
            if (map.hasOwnProperty(id)) {
                list.push(id);
            }
        }
        return list;
    };

    var load = new Loader();

    return {
        extend: extend,
        get: get,
        create: create,
        wakeUp: wakeUp,
        map: map,
        loader: load,
        eventbus: isBrowser ? null : require('./eventbus'),
        getLoadedComponents: getLoadedComponents,
        context: require('./context')
    }
})();
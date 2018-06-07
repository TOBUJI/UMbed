/*
 * UMbed.js
 * 
 * Automates inclusion of required JS & CSS. Optimizes load order, conflict/error handling,
 * reporting, and supports use in AMD (e.g. RequireJS) and CommonJS-like environments.
 * 
 * Note: Implements UMD pattern (see <https://github.com/umdjs/umd/blob/master/templates/returnExportsGlobal.js>).
 * There is significant complexity added because this is also a CSS/JS loader.
 * 
 * Example:
 *
 * <script>
 *   (function (u,m,b,e,d) { i[c]=i[c]||function(){(i[c].e=i[c].e||[]).push(arguments)};
 *   v=d.getElementsByTagName(s)[0]; e=d.createElement(s); e.src=o; e.async=0; v.parentNode.insertBefore(e,v);
 *   })(document,window,'script','UMbed','https://discoverymap.com/assets/webmap_embed.js');
 *   UMbed({
 *     container_id: 'umbed_target',
 *     container_css: "width: 50%; height: 50%;",
 *     init: function (something) {
 *       // some code
 *     }
 *   });
 * </script>
 * 
 * MIT License
 * 
 * Copyright (c) 2018 Discovery Map International
 * Copyright (c) 2018 Morgan T. Aldridge
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */

(function (root) {
  if ((root.UMbed === undefined) || ((typeof root.UMbed === 'function') && (root.UMbed.e !== undefined))) {
    /*
     * if the embed code injected a placeholder function to queue UMbed() calls, save any
     * queued UMbed calls for processing after creating the real function
     */
    var queued;
    if ((typeof root.UMbed === 'function') && (root.UMbed.e !== undefined) && Array.isArray(root.UMbed.e) && (root.UMbed.e.length > 0)) {
      queued = root.UMbed.e;
    }

    root.UMbed = function (options) {
      /* Dependencies Format:
       * 'mod' - UMD (AMD/CommonJS) module name for this requirement (optional)
       * 'obj' - Global JavaScript variable expected to be instantiated by this requirement, showing that it is loaded & ready (optional)
       * 'js'  - Array of JavaScript files that comprise this requirement and should be loaded (optional; if no 'mod' attribute is specified, will always load as normal JS script)
       * 'css' - Array of CSS files for this requirement and should be loaded (optional)
       */
      var _dependencies = [
      ];

      // AMD (RequireJS, et al)
      if ((typeof define === 'function') && define.amd) {
        _includeDependencies(true);
        require(_amdDependencies(), function () {
          _amdSetGlobals(arguments);
          _inject(options);
        });
      // CommonJS-like (Node, et al)
      } else if ((typeof module === 'object') && module.exports) {
        _includeDependencies(true);
        _requireDependencies();
        _inject(options);
      // Browser globals
      } else {
        _includeDependencies();
        root.addEventListener("load", function(e) {
          _inject(options);
        });
      }

      function _inject(options) {
        // default options
        options = extend({
          container_id: undefined,
          container_css: undefined
        }, options);

        // container_id is required
        if (!options.container_id) {
          console.log("ERROR! UMbed() requires a valid container_id! Unable to proceed.");
          return;
        }

        // look for our target element
        var embed = root.document.getElementById(options.container_id);
        if ((embed === undefined) || (embed === null))
          console.log("ERROR! UMbed() couldn't find element to attach to! Unable to proceed.");
          return;
        }

        // apply container_css to target element, if provided
        if (options.container_css !== undefined) {
          if (typeof options.container_css === 'object') {
            for (var property in options.container_css) {
              embed.style[property] = options.container_css[property];
            }
          } else if (typeof options.container_css === 'string') {
            embed.style = options.container_css;
          } else {
            console.log("ERROR! Invalid container_css value for UMbed()!");
          }
        }

        // ensure all required variables are available
        if (!_dependencies.every(function (d) {
          if ((d.obj !== undefined) && (_nestedProperty(root, d.obj) === undefined)) {
            console.log("ERROR! UMbed() couldn't find required variable 'window." + d.obj + "'!");
              return false;
            } else {
              return true;
            }
          })) {
            console.log("ERROR! UMbed() can't find one or more required objects! Cannot proceed.");
            return;
        }

        // run any provided initialization callback
        if (typeof options.init === 'function') {
          console.log("UMbed() calling init...");
          options.init();
        }
      }

      // Loader Helper Functions

      function _includeDependencies(noJSModules) {
        noJSModules = (typeof noJSModules === undefined) ? false : noJSModules;
        var includes = root.document.createDocumentFragment();

        _dependencies.forEach(function (d) {
          // include dependency's CSS file(s), unless already included
          if ((d.css !== undefined) && Array.isArray(d.css)) {
            d.css.forEach(function (url) {
              var versionedURL = _versionedURL(url, d.vers);
              if (_includesCSS(versionedURL)) {
                console.log("WARNING! CSS file '" + versionedURL + "' is already included! Will not include it for this UMbed dependency.");
              } else {
                console.log("Note: Inserting CSS file '" + versionedURL + "' LINK element.");
                _includeCSS(versionedURL, includes);
              }
            });
          }

          // include dependency's JS file(s), unless global already exists or JS file is already included
          // does the global variable already exist?
          if ((d.obj !== undefined) && (_nestedProperty(root, d.obj) !== undefined)) {
            console.log("WARNING! Global variable '" + d.obj + "' already exists! Will not include JS for this UMbed dependency.");
          } else if ((d.js !== undefined) && Array.isArray(d.js)) {
            d.js.forEach(function (url) {
              var versionedURL = _versionedURL(url, d.vers);
              if (_includesJS(versionedURL)) {
                console.log("ERROR! JS file '" + versionedURL + "' is already included! Will not include it for this UMbed dependency.");
              } else if ((d.mod !== undefined) && noJSModules) {
                console.log("Note: JS file '" + versionedURL + "' is specified to be loaded as a module as opposed to a SCRIPT element. Skipping SCRIPT element creation.");
              } else {
                console.log("Note: Inserting JS file '" + versionedURL + "' SCRIPT element.");
                _includeJS(versionedURL, includes);
              }
            });
          }
        });

        // inject all dependencies' elements into HEAD at once, because performance/efficiency
        if (includes.children.length > 0) {
          root.document.getElementsByTagName('head')[0].appendChild(includes);
        }
      }

      function _amdDependencies() {
        var deps = [];
        var config = {paths: {}};
        var shims = {};
        _dependencies.forEach(function (d) {
          if ((d.mod !== undefined) && (d.js !== undefined) && Array.isArray(d.js)) {
            console.log("UMbed AMD loader: preparing dependency for '" + d.mod + "' module...");
            deps.push(d.mod);
            config.paths[d.mod] = [];
            d.js.forEach(function (url) {
              var path = _pathForURL(_versionedURL(url, d.vers), 'js');
              console.log("UMbed AMD loader: Adding '" + d.mod + "' module config path: '" + path + "'");
              config.paths[d.mod].push(path);
            });
            if ((d.shim !== undefined) && (d.shim == true) && (d.obj !== undefined)) {
              shims[d.mod] = {};
              shims[d.mod]['exports'] = d.obj;
            }
          }
        });
        if (Object.keys(shims).length > 0) {
          config['shim'] = shims;
        }
        require.config(config);
        return deps;
      }

      function _amdSetGlobals(args) {
        var i = 0;
        _dependencies.forEach(function (d) {
          if ((d.mod !== undefined) && (d.js !== undefined) && Array.isArray(d.js) && (d.obj !== undefined) && (i < args.length)) {
            console.log("UMbed AMD loader: setting global variable '" + d.obj + "' for '" + d.mod + "' module...");
            root[d.obj] = args[i];
            i++;
          }
        });
      }

      function _requireDependencies() {
        _dependencies.forEach(function (d) {
          if ((d.mod !== undefined) && (d.js !== undefined) && Array.isArray(d.js)) {
            d.js.forEach(function (path) {
              if (d.obj !== undefined) {
                root[d.obj] = require(_versionedURL(path, d.vers));
              } else {
                require(_versionedURL(path, d.vers));
              }
            });
          }
        });
      }

      function _includeCSS(path, parent) {
        // build the CSS include tag
        var link = root.document.createElement('link');
        link.rel = "stylesheet";
        link.media = "screen";
        link.href = path;
        parent.appendChild(link);
      }

      function _includeJS(path, parent) {
        var script = root.document.createElement('script');
        script.src = path;
        parent.appendChild(script);
      }

      function _includesCSS(url) {
        return Array.from(root.document.getElementsByTagName('link')).some(function (e) {
          return _urlEndsWith(e.href, _filenameForURL(url, 'css'));
        });
      }

      function _includesJS(url) {
        return Array.from(root.document.getElementsByTagName('script')).some(function (e) {
          return _urlEndsWith(e.src, _filenameForURL(url, 'js'));
        });
      }

      function _versionedURL(url, version) {
        return url.replace(/{vers}/g, version);
      }

      function _filenameForURL(url, ext) {
        if (url === undefined) { return null; }
        var matches = url.match(new RegExp('\/([^\/]*\.' + ext + ')$', 'i'));
        return (matches !== null) ? matches[1] : null;
      }

      function _pathForURL(url, ext) {
        if (url === undefined) { return null; }
        return url.replace(new RegExp('\.' + ext + '$'), '');
      }

      function _urlEndsWith(url, filename) {
        if ((url === undefined) || (url === null) || (url === '') || (filename === undefined ) || (filename === null) || (filename === '')) {
          return false;
        }
        return (new RegExp(filename.replace(/\./g, '\.') + '$')).test(url);
      }

      function _nestedProperty(obj, prop) {
        if (obj === undefined) { return; }
        var pos = prop.indexOf('.');
        return (pos < 0) ? obj[prop] : _nestedProperty(obj[prop.substring(0, pos)], prop.substring(pos + 1));
      }

      // Misc Helper Functions

      /*! extend.js | (c) 2017 Chris Ferdinandi, (c) 2018 Morgan Aldridge | MIT License | http://github.com/morgant/extend */
      /**
       * Merge two or more objects together into the first object. Same method signature as jQuery.extend().
       * @param {Boolean}  deep     If true, do a deep (or recursive) merge [optional]
       * @param {Object}   target   The target object to be merged into & modified
       * @param {Object}   objects  The object(s) to merge into the target object
       * @returns {Object}          Target object with merged values from object(s)
       */
      function extend() {
        var target;
        var deep = false;
        var i = 0;
        var length = arguments.length;

        // Check if a deep merge
        if ( Object.prototype.toString.call( arguments[0] ) === '[object Boolean]' ) {
          deep = arguments[0];
          i++;
        }

        // Get the target object
        if ( ( length - i >= 1 ) && ( Object.prototype.toString.call( arguments[i] ) === '[object Object]' ) ) {
          target = arguments[i];
          i++;
        }

        // Merge the object into the extended object
        var merge = function ( obj ) {
          for ( var prop in obj ) {
            if ( Object.prototype.hasOwnProperty.call( obj, prop ) ) {
              // If deep merge and property is an object, merge properties
              if ( deep && Object.prototype.toString.call(obj[prop]) === '[object Object]' ) {
                target[prop] = extend( true, target[prop], obj[prop] );
              } else {
                target[prop] = obj[prop];
              }
            }
          }
        };

        // Loop through each object and conduct a merge
        for ( ; i < length; i++ ) {
          var obj = arguments[i];
          merge(obj);
        }

        return target;
      }
    };

    // Execute any queued calls to UMbed()
    if ((queued !== undefined) && Array.isArray(queued)) {
      while (queued.length > 0) {
        UMbed.apply(null, queued.pop());
      };
    }
  }
})(typeof self !== 'undefined' ? self : this);
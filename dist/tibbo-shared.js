"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKAGE_VERSION = exports.TIBBO_BROADCAST_ADDR = exports.TIBBO_BROADCAST_PORT = void 0;
exports.TIBBO_BROADCAST_PORT = 65535;
exports.TIBBO_BROADCAST_ADDR = '255.255.255.255';
const packageJSON = require('../package.json');
exports.PACKAGE_VERSION = packageJSON.version;

### Tibbo Discover
[![Coverage Status](https://coveralls.io/repos/github/128keaton/Tibbo-Discover/badge.svg?branch=mane)](https://coveralls.io/github/128keaton/Tibbo-Discover?branch=mane)
[![npm version](https://badge.fury.io/js/tibbo-discover.svg)](https://badge.fury.io/js/tibbo-discover) ![Build](https://github.com/128keaton/Tibbo-Discover/actions/workflows/code-coverage.yml/badge.svg)

Discover Tibbo devices on the network

```bash
npm i tibbo-discover
```



#### Usage

##### Library

```typescript
const tibboDiscover = new TibboDiscover();

tibboDiscover.scan().then(devices => {
    console.log(devices);
});
```

#### CLI
```bash
$ tibbo-discover.js > devices.json
```

```json
 [
    {
      "board": "TPP2W(G2)-4.00.01",
      "application": "Controlled By Web",
      "ipAddress": "10.0.1.222",
      "id": "[000.036.119.087.075.144]"
    }
  ]
```

#### Functions

* Scan - `scan(timeout?: number = 5000)`

    Scan for Tibbo devices on the network, with an optional timeout (default: 5000)

<br>

* Query - `query(id: sting, timeout?: number = 5000)`

    Query information from a Tibbo device on the network, with an optional timeout (default: 5000)

<br>

* Stop - `stop()`

    Stops all active connections and closes any open sockets

<br>

* Login - `login(ipAddress: string, password: string, key: string)`

    Stops all active connections and closes any open sockets. 
Requires the Tibbo device IP address, password, and optionally a shared authentication "key" which
defaults to `tibbo123`.

<br>

* Buzz - `buzz(ipAddress: string, password: string, key: string)`

    Buzz the Tibbo at the IP address passed to the function

<br>

* Reboot - `reboot(ipAddress: string, password: string, key: string)`

    Reboot the Tibbo at the IP address passed to the function

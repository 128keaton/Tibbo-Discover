### Tibbo Discover
[![Coverage Status](https://coveralls.io/repos/github/128keaton/Tibbo-Discover/badge.svg?branch=mane)](https://coveralls.io/github/128keaton/Tibbo-Discover?branch=mane)
[![npm version](https://badge.fury.io/js/tibbo-discover.svg)](https://badge.fury.io/js/tibbo-discover) ![Build](https://github.com/128keaton/Tibbo-Discover/actions/workflows/code-coverage.yml/badge.svg)

Discover Tibbo devices on the network

```bash
npm i tibbo-discover
```



#### Usage

##### Either use as a library:

```typescript
const tibboDiscover = new TibboDiscover();

tibboDiscover.scan();

tibboDiscover.devices.subscribe(devices => {
      console.log(devices);
});
```

#### Or directly from the CLI:
```bash
$ tibbo-discover.js > devices.json
```

```json
{
  "devices": [
    {
      "boardType": "TPP2W(G2)-4.00.01",
      "data": "bbf3c1bb-2596-41b7-9a13-c1527f405b23",
      "currentApp": "Controlled By Web",
      "address": "10.0.1.222",
      "id": "[000.036.119.087.075.144]",
      "macAddress": "0:36:119:87:75:144"
    }
  ]
}
```

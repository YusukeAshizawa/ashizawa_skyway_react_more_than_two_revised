import {
  nowInSec,
  SfuRoomOptions,
  SkyWayAuthToken,
  SkyWayConfigOptions,
  uuidV4,
} from '@skyway-sdk/room';

import { appId, secret } from '../../../env';

const testToken = new SkyWayAuthToken({
  jti: uuidV4(),
  iat: nowInSec(),
  exp: nowInSec() + 60 * 60 * 24,
  scope: {
    app: {
      id: appId,
      turn: true,
      actions: ['read'],
      channels: [
        {
          id: '*',
          name: '*',
          actions: ['write'],
          members: [
            {
              id: '*',
              name: '*',
              actions: ['write'],
              publication: {
                actions: ['write'],
              },
              subscription: {
                actions: ['write'],
              },
            },
          ],
          sfuBots: [
            {
              actions: ['write'],
              forwardings: [
                {
                  actions: ['write'],
                },
              ],
            },
          ],
        },
      ],
    },
  },
});
// const testToken = new SkyWayAuthToken({
//   jti: uuidV4(),
//   iat: nowInSec(),
//   exp: nowInSec() + 60 * 60 * 24,
//   version: 3,
//   scope: {
//     appId: appId,
//     rooms: [
//       {
//         name: "*",
//         methods: ["create", "close", "updateMetadata"],
//         member: {
//           name: "*",
//           methods: ["publish", "subscribe", "updateMetadata"],
//         },
//         sfu: {
//           enabled: true,
//         },
//       },
//     ],
//     turn: {
//       enabled: true
//     },
//   },
// });
export const tokenString = testToken.encode(secret);
export const contextOptions: Partial<SkyWayConfigOptions> = {
  log: { level: 'debug' },
};
export const sfuOptions: Partial<SfuRoomOptions> = {};

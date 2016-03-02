/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule RelayOSSNodeInterface
 * @typechecks
 * @flow
 */

'use strict';

import type {DataID} from 'RelayInternalTypes';
import type RelayQuery from 'RelayQuery';
import type RelayRecordStore from 'RelayRecordStore';

const forEachRootCallArg = require('forEachRootCallArg');
const generateClientID = require('generateClientID');
const invariant = require('invariant');

type PayloadResult = {
  dataID: DataID;
  result: mixed;
  rootCallInfo?: RootCallInfo;
};

type RootCallInfo = {
  storageKey: string;
  identifyingArgKey: ?string;
}

/**
 * @internal
 *
 * Defines logic relevant to the informal "Node" GraphQL interface.
 */
var RelayOSSNodeInterface = {
  ANY_TYPE: '__any',
  ID: 'id',
  ID_TYPE: 'ID!',
  NODE: 'node',
  NODE_TYPE: 'Node',
  NODES: 'nodes',
  TYPENAME: '__typename',

  isNodeRootCall(fieldName: string): boolean {
    return (
      fieldName === RelayOSSNodeInterface.NODE ||
      fieldName === RelayOSSNodeInterface.NODES
    );
  },

  getResultsFromPayload(
    store: RelayRecordStore,
    query: RelayQuery.Root,
    payload: {[key: string]: mixed}
  ): Array<PayloadResult> {
    var results = [];

    var rootBatchCall = query.getBatchCall();
    if (rootBatchCall) {
      getPayloadRecords(query, payload).forEach(result => {
        if (typeof result !== 'object' || !result) {
          return;
        }
        var dataID = result[RelayOSSNodeInterface.ID];
        invariant(
          dataID != null,
          'RelayOSSNodeInterface.getResultsFromPayload(): Unable to write ' +
          'result with no `%s` field for query, `%s`.',
          RelayOSSNodeInterface.ID,
          query.getName()
        );
        results.push({dataID, result});
      });
    } else {
      var records = getPayloadRecords(query, payload);
      var ii = 0;
      const storageKey = query.getStorageKey();
      forEachRootCallArg(query, ({identifyingArgKey}) => {
        var result = records[ii++];
        var dataID = store.getDataID(storageKey, identifyingArgKey);
        if (dataID == null) {
          var payloadID = typeof result === 'object' && result ?
            result[RelayOSSNodeInterface.ID] :
            null;
          if (payloadID != null) {
            dataID = payloadID;
          } else {
            dataID = generateClientID();
          }
        }
        results.push({
          dataID,
          result,
          rootCallInfo: {storageKey, identifyingArgKey},
        });
      });
    }

    return results;
  },
};

function getPayloadRecords(
  query: RelayQuery.Root,
  payload: {[key: string]: mixed}
): Array<mixed> {
  var fieldName = query.getFieldName();
  const identifyingArg = query.getIdentifyingArg();
  const identifyingArgKey = (identifyingArg && identifyingArg.value) || null;
  var records = payload[fieldName];
  if (!query.getBatchCall()) {
    if (Array.isArray(identifyingArgKey)) {
      invariant(
        Array.isArray(records),
        'RelayOSSNodeInterface: Expected payload for root field `%s` to be ' +
        'an array with %s results, instead received a single non-array result.',
        fieldName,
        identifyingArgKey.length
      );
      invariant(
        records.length === identifyingArgKey.length,
        'RelayOSSNodeInterface: Expected payload for root field `%s` to be ' +
        'an array with %s results, instead received an array with %s results.',
        fieldName,
        identifyingArgKey.length,
        records.length
      );
    } else if (Array.isArray(records)) {
      invariant(
        false,
        'RelayOSSNodeInterface: Expected payload for root field `%s` to be ' +
        'a single non-array result, instead received an array with %s results.',
        fieldName,
        records.length
      );
    }
  }
  return Array.isArray(records) ? records : [records];
}

module.exports = RelayOSSNodeInterface;

'use strict';

const constants = require('../../../lib/constants');
const httpMocks = require('node-mocks-http');
const sinon = require('sinon');
const storj = require('storj-lib');
const expect = require('chai').expect;
const errors = require('storj-service-error-types');
const EventEmitter = require('events').EventEmitter;
const ReportsRouter = require('../../../lib/server/routes/reports');
const utils = require('../../../lib/utils');
const farmerMiddleware = require('../../../lib/server/middleware/farmer-auth');

describe('ReportsRouter', function() {
  var reportsRouter = new ReportsRouter(
    require('../../_fixtures/router-opts')
  );

  describe('#authMiddleware', function() {
    var sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('it will auth user with user auth headers', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {},
        headers: {
          'authorization': 'base64authstring'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      var testReportsRouter = new ReportsRouter(
        require('../../_fixtures/router-opts')
      );
      const bodyParser = sinon.stub().callsArgWith(2, null);
      const userAuth = sinon.stub().callsArgWith(2, null);
      testReportsRouter.userAuthMiddlewares = [
        bodyParser,
        userAuth
      ];
      testReportsRouter.authMiddleware(request, response, function(err) {
        if (err) {
          return done(err);
        }
        expect(bodyParser.callCount).to.equal(0);
        expect(userAuth.callCount).to.equal(1);
        done();
      });
    });
    it('it will auth farmer with farmer auth headers', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {},
        headers: {
          'x-node-id': '14fe443f9bfe4936fb70dd97298cc6a34c88cfba'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(farmerMiddleware, 'authFarmer').callsArgWith(2, null);
      reportsRouter.authMiddleware(request, response, function(err) {
        if (err) {
          return done(err);
        }
        expect(farmerMiddleware.authFarmer.callCount).to.equal(1);
        done();
      });
    });
    it('it will error if no auth', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {},
        headers: {}
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      reportsRouter.authMiddleware(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotAuthorizedError);
        done();
      });
    });
  });

  describe('#updateReputation', function() {
    var sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    it('will record points and save', function() {
      const contact = {
        recordPoints: sandbox.stub().returns({
          save: sandbox.stub().callsArgWith(0, null)
        })
      };
      sandbox.stub(reportsRouter.storage.models.Contact, 'findOne')
        .callsArgWith(1, null, contact);
      const nodeID = '2c5ae6807e9179cb2174d0265867c63abce48dfb';
      const points = 10;
      reportsRouter.updateReputation(nodeID, points);
      expect(reportsRouter.storage.models.Contact.findOne.callCount)
        .to.equal(1);
      expect(reportsRouter.storage.models.Contact.findOne.args[0][0])
        .to.eql({_id: nodeID});
      expect(contact.recordPoints.callCount).to.equal(1);
    });

    it('will return if contact not found', function() {
      const contact = {
        recordPoints: sandbox.stub().returns({
          save: sandbox.stub().callsArgWith(0, null)
        })
      };
      sandbox.stub(reportsRouter.storage.models.Contact, 'findOne')
        .callsArgWith(1, null, null);
      const nodeID = '2c5ae6807e9179cb2174d0265867c63abce48dfb';
      const points = 10;
      reportsRouter.updateReputation(nodeID, points);
      expect(contact.recordPoints.callCount).to.equal(0);
    });
  });

  describe('#validateExchangeReport', function() {
    var sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    const validReports = [{
      token: '91e1fc2fd3a4c5244945e49c6f68ca1bd444d14c',
      exchangeStart: 1509156812066,
      exchangeEnd: 1509156822420,
      exchangeResultCode: 1100,
      exchangeResultMessage: 'FAILED_INTEGRITY'
    }, {
      token: 'fe081d837b4c6bbb0e416b8acd7b04ed29203f08',
      exchangeStart: 1509156792819,
      exchangeEnd: 1509156801731,
      exchangeResultCode: 1000,
      exchangeResultMessage: 'SHARD_DOWNLOADED'
    }, {
      token: 'a9d2c8cee65ad1b6ddb7cd574a18081f44ab8391',
      exchangeStart: 1509156773796,
      exchangeEnd: 1509156782011,
      exchangeResultCode: 1100,
      exchangeResultMessage: 'SHARD_UPLOADED'
    }, {
      token: 'b345adbe445452b6b451e4b8ca4beac2a548e22d',
      exchangeStart: 1509156753155,
      exchangeEnd: 1509156763347,
      exchangeResultCode: 1000,
      exchangeResultMessage: 'DOWNLOAD_ERROR'
    }, {
      token: '6563ac73bee62df44880da382cd352e3e2fe3374',
      exchangeStart: 1509156731683,
      exchangeEnd: 1509156742560,
      exchangeResultCode: 1100,
      exchangeResultMessage: 'TRANSFER_FAILED'
    }, {
      token: '518252128d9eb93b717618558ac64cf0bb882b36',
      exchangeStart: 1509156731883,
      exchangeEnd: 1509156732883,
      exchangeResultCode: 1100,
      exchangeResultMessage: 'MIRROR_SUCCESS'
    }];

    const invalidReports = [{
      token: '91e1fc2fd3a4c5244945e49c6f68ca1bd444d14c',
      exchangeStart: 1509156812066,
      exchangeEnd: 1509156822420,
      exchangeResultCode: 1100,
      exchangeResultMessage: 'NOT_A_VALID_MESSAGE' // invalid
    }, {
      token: 'fe081d837b4c6bbb0e416b8acd7b04ed29203f08',
      exchangeStart: 'tuesday', // invalid
      exchangeEnd: 1509156822421,
      exchangeResultCode: 1000,
      exchangeResultMessage: 'SHARD_DOWNLOADED'
    }, {
      token: 'fe081d837b4c6bbb0e416b8acd7b04ed29203f08',
      exchangeStart: 1509156812068,
      exchangeEnd: 'wednesday', // invalid
      exchangeResultCode: 1000,
      exchangeResultMessage: 'SHARD_DOWNLOADED'
    }, {
      token: 'a9d2c8cee65ad1b6ddb7cd574a18081f44ab8391',
      exchangeStart: 1509156773796,
      exchangeEnd: 1509156782011,
      exchangeResultCode: 1234567890, // invalid
      exchangeResultMessage: 'SHARD_UPLOADED'
    }];

    let i = 0;
    validReports.forEach((report) => {
      it('will validate report (' + i + ')', function() {
        expect(reportsRouter.validateExchangeReport(report)).to.equal(true);
      });
      i++;
    });

    invalidReports.forEach((report) => {
      it('will invalidate report (' + i + ')', function() {
        expect(reportsRouter.validateExchangeReport(report)).to.equal(false);
      });
      i++;
    });

  });

  describe('#createExchangeReport', function() {
    var sandbox = sinon.sandbox.create();
    afterEach(function() {
      sandbox.restore();
    });

    it('should give internal error', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          token: 'f4c0fcfcc818e162c39b9b678a54124c847c0f9a',
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.StorageEvent,
        'findOne'
      ).callsArgWith(1, new Error('test'));
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.InternalError);
        done();
      });
    });

    it('should give not found without matching token', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          token: 'f4c0fcfcc818e162c39b9b678a54124c847c0f9a',
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SUCCESS'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      sandbox.stub(
        reportsRouter.storage.models.StorageEvent,
        'findOne'
      ).callsArgWith(1, null, null);
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotFoundError);
        done();
      });
    });

    it('should give bad request error with invalid report', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          token: 'f4c0fcfcc818e162c39b9b678a54124c847c0f9a',
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1234567890,
          exchangeResultMessage: 'NOT_A_MESSAGE'
        }
      });
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      const event = {};
      sandbox.stub(
        reportsRouter.storage.models.StorageEvent,
        'findOne'
      ).callsArgWith(1, null, event);
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.BadRequestError);
        done();
      });
    });

    it('should give not authorized if not valid reporter', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          token: 'f4c0fcfcc818e162c39b9b678a54124c847c0f9a',
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SHARD_DOWNLOADED'
        }
      });
      request.user = {
        id: 'userid1'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      const event = {
        client: 'userid2'
      };
      sandbox.stub(
        reportsRouter.storage.models.StorageEvent,
        'findOne'
      ).callsArgWith(1, null, event);
      reportsRouter.createExchangeReport(request, response, function(err) {
        expect(err).to.be.instanceOf(errors.NotAuthorizedError);
        done();
      });
    });

    it('will update storage event with client (success)', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          token: 'f4c0fcfcc818e162c39b9b678a54124c847c0f9a',
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SHARD_DOWNLOADED'
        }
      });
      request.user = {
        id: 'userid1'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      const event = {
        client: 'userid1',
        farmer: 'nodeid',
        save: sandbox.stub().callsArgWith(0, null)
      };
      sandbox.stub(reportsRouter, '_handleExchangeReport');
      sandbox.stub(reportsRouter, 'updateReputation');
      sandbox.stub(
        reportsRouter.storage.models.StorageEvent,
        'findOne'
      ).callsArgWith(1, null, event);
      response.on('end', function() {
        expect(reportsRouter.updateReputation.callCount).to.equal(1);
        expect(reportsRouter.updateReputation.args[0][0]).to.equal('nodeid');
        expect(reportsRouter.updateReputation.args[0][1]).to.equal(10);
        expect(event.save.callCount).to.equal(1);
        expect(response.statusCode).to.equal(201);
        done();
      });
      reportsRouter.createExchangeReport(request, response);
    });

    it('will update storage event with client (failure)', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          token: 'f4c0fcfcc818e162c39b9b678a54124c847c0f9a',
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1100,
          exchangeResultMessage: 'SHARD_DOWNLOADED'
        }
      });
      request.user = {
        id: 'userid1'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      const event = {
        client: 'userid1',
        farmer: 'nodeid',
        save: sandbox.stub().callsArgWith(0, null)
      };
      sandbox.stub(reportsRouter, '_handleExchangeReport');
      sandbox.stub(reportsRouter, 'updateReputation');
      sandbox.stub(
        reportsRouter.storage.models.StorageEvent,
        'findOne'
      ).callsArgWith(1, null, event);
      response.on('end', function() {
        expect(reportsRouter.updateReputation.callCount).to.equal(1);
        expect(reportsRouter.updateReputation.args[0][0]).to.equal('nodeid');
        expect(reportsRouter.updateReputation.args[0][1]).to.equal(-10);
        expect(event.save.callCount).to.equal(1);
        expect(response.statusCode).to.equal(201);
        done();
      });
      reportsRouter.createExchangeReport(request, response);
    });

    it('will update storage event with client (idempotence)', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          token: 'f4c0fcfcc818e162c39b9b678a54124c847c0f9a',
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SHARD_DOWNLOADED'
        }
      });
      request.user = {
        id: 'userid1'
      };
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      const event = {
        client: 'userid1',
        save: sandbox.stub().callsArgWith(0, null),
        clientReport: {
          exchangeResultCode: 1100 // already has report
        }
      };
      sandbox.stub(reportsRouter, '_handleExchangeReport');
      sandbox.stub(
        reportsRouter.storage.models.StorageEvent,
        'findOne'
      ).callsArgWith(1, null, event);
      response.on('end', function() {
        expect(event.save.callCount).to.equal(0);
        expect(response.statusCode).to.equal(200);
        done();
      });
      reportsRouter.createExchangeReport(request, response);
    });

    it('will update storage event with farmer', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          token: 'f4c0fcfcc818e162c39b9b678a54124c847c0f9a',
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SHARD_DOWNLOADED'
        }
      });
      request.farmerNodeID = '4b449e6445daf4bfe0e7add6ca10bd66e27e1663';
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      const event = {
        farmer: '4b449e6445daf4bfe0e7add6ca10bd66e27e1663',
        save: sandbox.stub().callsArgWith(0, null)
      };
      sandbox.stub(reportsRouter, '_handleExchangeReport');
      sandbox.stub(
        reportsRouter.storage.models.StorageEvent,
        'findOne'
      ).callsArgWith(1, null, event);
      response.on('end', function() {
        expect(event.save.callCount).to.equal(1);
        expect(response.statusCode).to.equal(201);
        done();
      });
      reportsRouter.createExchangeReport(request, response);
    });

    it('will update storage event with farmer (idempotence)', function(done) {
      var request = httpMocks.createRequest({
        method: 'POST',
        url: '/reports/exchanges',
        body: {
          token: 'f4c0fcfcc818e162c39b9b678a54124c847c0f9a',
          exchangeStart: Date.now(),
          exchangeEnd: Date.now(),
          exchangeResultCode: 1000,
          exchangeResultMessage: 'SHARD_DOWNLOADED'
        }
      });
      request.farmerNodeID = '4b449e6445daf4bfe0e7add6ca10bd66e27e1663';
      var response = httpMocks.createResponse({
        req: request,
        eventEmitter: EventEmitter
      });
      const event = {
        farmer: '4b449e6445daf4bfe0e7add6ca10bd66e27e1663',
        save: sandbox.stub().callsArgWith(0, null),
        farmerReport: {
          exchangeResultCode: 1100 // already has report
        }
      };
      sandbox.stub(reportsRouter, '_handleExchangeReport');
      sandbox.stub(
        reportsRouter.storage.models.StorageEvent,
        'findOne'
      ).callsArgWith(1, null, event);
      response.on('end', function() {
        expect(event.save.callCount).to.equal(0);
        expect(response.statusCode).to.equal(200);
        done();
      });
      reportsRouter.createExchangeReport(request, response);
    });

  });

  describe('#_handleExchangeReport', function() {

    let _triggerMirrorEstablish;

    before(() => {
      _triggerMirrorEstablish = sinon.stub(
        reportsRouter,
        '_triggerMirrorEstablish'
      ).callsArg(3);
    });
    after(() => _triggerMirrorEstablish.restore());

    it('should callback error if not valid report type', function(done) {
      const event = {};
      reportsRouter._handleExchangeReport({
        shardHash: 'hash',
        exchangeResultMessage: 'NOT_VALID'
      }, event, (err) => {
        expect(err.message).to.equal(
          'Exchange result type will not trigger action'
        );
        done();
      });
    });

    it('should trigger a mirror on SHARD_UPLOADED', function(done) {
      const event = {};
      reportsRouter._handleExchangeReport({
        shardHash: 'hash',
        exchangeResultMessage: 'SHARD_UPLOADED'
      }, event, done);
    });

    it('should trigger a mirror on MIRROR_SUCCESS', function(done) {
      const event = {};
      reportsRouter._handleExchangeReport({
        shardHash: 'hash',
        exchangeResultMessage: 'MIRROR_SUCCESS'
      }, event, done);
    });

    it('should trigger a mirror on MIRROR_FAILED', function(done) {
      const event = {};
      reportsRouter._handleExchangeReport({
        shardHash: 'hash',
        exchangeResultMessage: 'MIRROR_FAILED'
      }, event, done);
    });

    it('should trigger a mirror on DOWNLOAD_ERROR', function(done) {
      const event = {};
      reportsRouter._handleExchangeReport({
        shardHash: 'hash',
        exchangeResultMessage: 'DOWNLOAD_ERROR'
      }, event, done);
    });

  });

  describe('@_sortByTimeoutRate', function() {
    it('will sort with the best timeout rate (0) at top', function() {
      const mirrors = [{
        contact: { timeoutRate: 0.99 }
      }, {
        contact: { timeoutRate: 0.03 }
      }, {
        contact: { }
      }, {
        contact: { timeoutRate: 0.98 }
      }, {
        contact: { timeoutRate: 0.98 }
      }, {
        contact: { timeoutRate: 1 }
      }, {
        contact: { timeoutRate: 0 }
      }];

      mirrors.sort(ReportsRouter._sortByTimeoutRate);

      expect(mirrors).to.eql([{
        contact: { }
      }, {
        contact: { timeoutRate: 0 }
      }, {
        contact: { timeoutRate: 0.03 }
      }, {
        contact: { timeoutRate: 0.98 }
      }, {
        contact: { timeoutRate: 0.98 }
      }, {
        contact: { timeoutRate: 0.99 }
      }, {
        contact: { timeoutRate: 1 }
      }]);
    });
  });

  describe('@_sortByResponseTime', function() {
    it('will sort correctly with best response time at index 0', function() {
      var available = [
        { contact: { responseTime: 10100 }},
        { contact: {} },
        { contact: { responseTime: 100 }},
        { contact: {} },
        { contact: { responseTime: 200 }},
        { contact: { responseTime: 4100 }},
        { contact: { responseTime: 2100 }}
      ];
      available.sort(ReportsRouter._sortByResponseTime);
      expect(available).to.eql([
        { contact: { responseTime: 100 }},
        { contact: { responseTime: 200 }},
        { contact: { responseTime: 2100 }},
        { contact: { responseTime: 4100 }},
        { contact: { responseTime: 10100}},
        { contact: {}},
        { contact: {}}
      ]);
    });
  });

  describe('#_triggerMirrorEstablish', function() {
    const sandbox = sinon.sandbox.create();
    afterEach(() => sandbox.restore());

    const n = constants.M_REPLICATE;
    const hash = storj.utils.rmd160('');

    it('should successfully replicate the shard', function(done) {
      sandbox.spy(Array.prototype, 'sort');
      const mirrors = [
        new reportsRouter.storage.models.Mirror({
          shardHash: 'shardhash',
          contact: null, // populated contact field not found
          contract: {
            data_hash: storj.utils.rmd160('shardhash')
          },
          isEstablished: true
        }),
        new reportsRouter.storage.models.Mirror({
          shardHash: 'shardhash',
          contact: new reportsRouter.storage.models.Contact({
            _id: storj.utils.rmd160('node1'),
            address: '0.0.0.0',
            port: 1234,
            protocol: '1.0.0',
            lastSeen: Date.now(),
            userAgent: 'test'
          }),
          contract: {
            data_hash: storj.utils.rmd160('shardhash')
          },
          isEstablished: true
        }),
        new reportsRouter.storage.models.Mirror({
          shardHash: 'shardhash',
          contact: new reportsRouter.storage.models.Contact({
            _id: storj.utils.rmd160('node2'),
            address: '0.0.0.0',
            port: 1234,
            protocol: '1.0.0',
            lastSeen: Date.now(),
            userAgent: 'test'
          }),
          contract: {
            data_hash: storj.utils.rmd160('shardhash')
          },
          isEstablished: false
        }),
        new reportsRouter.storage.models.Mirror({
          shardHash: 'shardhash',
          contact: new reportsRouter.storage.models.Contact({
            _id: '28dd8e03bf86f7cf14ac7866c44628cebb21a2d3',
            address: '0.0.0.0',
            port: 1234,
            protocol: '1.0.0',
            lastSeen: Date.now(),
            userAgent: 'test'
          }),
          contract: {
            data_hash: storj.utils.rmd160('shardhash')
          },
          isEstablished: false
        })
      ];
      sandbox.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, mirrors)
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          },
          '28dd8e03bf86f7cf14ac7866c44628cebb21a2d3': {}
        }
      });
      sandbox.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      sandbox.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      sandbox.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, {
        farmer: {
          nodeID: '9fbe85050ecf276e3f47a979cb33bc55172ad241'
        }
      });
      sandbox.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      sandbox.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      const event = {};
      sandbox.stub(reportsRouter, '_createStorageEvent');
      reportsRouter._triggerMirrorEstablish(n, hash, event, function(err) {
        expect(err).to.equal(null);
        expect(Array.prototype.sort.callCount).to.equal(1);
        expect(Array.prototype.sort.args[0][0])
          .to.equal(utils.sortByReputation);
        done();
      });
    });

    it('should error if net mirroring fails', function(done) {
      sandbox.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node1'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: true
              }),
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node2'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: false
              })
            ])
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          }
        }
      });
      sandbox.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      sandbox.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      sandbox.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, {
        farmer: {
          nodeID: '9fbe85050ecf276e3f47a979cb33bc55172ad241'
        }
      });
      sandbox.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, new Error('Failed to mirror data'));
      sandbox.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      const event = {};
      sandbox.stub(reportsRouter, '_createStorageEvent');
      reportsRouter._triggerMirrorEstablish(n, hash, event, function(err) {
        expect(err.message).to.equal('Failed to mirror data');
        done();
      });
    });

    it('should error if no pointer can be retrieved', function(done) {
      sandbox.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node1'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: true
              }),
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node2'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: false
              })
            ])
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          }
        }
      });
      sandbox.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      sandbox.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      sandbox.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, new Error('Failed to retrieve pointer'));
      sandbox.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      sandbox.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      const event = {};
      sandbox.stub(reportsRouter, '_createStorageEvent');
      reportsRouter._triggerMirrorEstablish(n, hash, event, function(err) {
        expect(err.message).to.equal('Failed to get pointer');
        done();
      });
    });

    it('should error if no pointer can be retrieved', function(done) {
      sandbox.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node1'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: true
              }),
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node2'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: false
              })
            ])
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          }
        }
      });
      sandbox.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      sandbox.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, new Error('Contact not found'));
      sandbox.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, { /* pointer */ });
      sandbox.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      sandbox.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      const event = {};
      sandbox.stub(reportsRouter, '_createStorageEvent');
      reportsRouter._triggerMirrorEstablish(n, hash, event, function(err) {
        expect(err.message).to.equal('Failed to get pointer');
        done();
      });
    });
    it('should error if the contract cannot load', function(done) {
      sandbox.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node1'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: true
              }),
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node2'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: false
              })
            ])
          };
        }
      });
      sandbox.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, new Error('Failed to load contract'));
      sandbox.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      sandbox.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, { /* pointer */ });
      sandbox.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      sandbox.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      const event = {};
      sandbox.stub(reportsRouter, '_createStorageEvent');
      reportsRouter._triggerMirrorEstablish(n, hash, event, function(err) {
        expect(err.message).to.equal('Failed to load contract');
        done();
      });
    });

    it('should error if the mirror limit is reached', function(done) {
      sandbox.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node1'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: true
              }),
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node2'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash')
                },
                isEstablished: false
              }),
              new reportsRouter.storage.models.Mirror({
                shardHash: 'shardhash',
                contact: new reportsRouter.storage.models.Contact({
                  _id: storj.utils.rmd160('node3'),
                  address: '0.0.0.0',
                  port: 1234,
                  protocol: '1.0.0',
                  lastSeen: Date.now(),
                  userAgent: 'test'
                }),
                contract: {
                  data_hash: storj.utils.rmd160('shardhash3')
                },
                isEstablished: true
              })
            ])
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          '2b6e0d0e45c1dcea62f701a31e4be1b507ab67d4': {},
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          }
        }
      });
      sandbox.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      sandbox.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      sandbox.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, { /* pointer */ });
      sandbox.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      sandbox.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      const event = {};
      sandbox.stub(reportsRouter, '_createStorageEvent');
      reportsRouter._triggerMirrorEstablish(2, hash, event, function(err) {
        expect(err.message).to.equal('Auto mirroring limit is reached');
        done();
      });
    });

    it('should error if no mirrors are available', function(done) {
      sandbox.stub(
        reportsRouter.storage.models.Mirror,
        'find'
      ).returns({
        populate: () => {
          return {
            exec: sinon.stub().callsArgWith(0, null, [])
          };
        }
      });
      var item = storj.StorageItem({
        hash: storj.utils.rmd160('shardhash'),
        contracts: {
          node3: {
            data_hash: storj.utils.rmd160('shardhash')
          }
        }
      });
      sandbox.stub(
        reportsRouter.contracts,
        'load'
      ).callsArgWith(1, null, item);
      sandbox.stub(
        reportsRouter,
        'getContactById'
      ).callsArgWith(1, null, new reportsRouter.storage.models.Contact({
        _id: storj.utils.rmd160('node2'),
        address: '0.0.0.0',
        port: 1234,
        protocol: '1.0.0',
        lastSeen: Date.now(),
        userAgent: 'test'
      }));
      sandbox.stub(
        reportsRouter.network,
        'getRetrievalPointer'
      ).callsArgWith(2, null, { /* pointer */ });
      sandbox.stub(
        reportsRouter.network,
        'getMirrorNodes'
      ).callsArgWith(2, null);
      sandbox.stub(
        reportsRouter.contracts,
        'save'
      ).callsArgWith(1, null);
      const event = {};
      sandbox.stub(reportsRouter, '_createStorageEvent');
      reportsRouter._triggerMirrorEstablish(n, hash, event, function(err) {
        expect(err.message).to.equal('No available mirrors');
        done();
      });
    });

  });

});

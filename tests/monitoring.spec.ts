const { expect } = require('chai');
const sinon = require('sinon');
import axios from 'axios';
import mongoose from 'mongoose';

// We need to stub ln/connect before importing monitoring
// to prevent LND connection errors during tests
const proxyquire = require('proxyquire').noCallThru();

const { collectHealthData, sendHeartbeat } = proxyquire('../monitoring', {
  './ln': {
    getInfo: async () => ({
      alias: 'test-node',
      active_channels_count: 5,
      peers_count: 3,
      is_synced_to_chain: true,
      is_synced_to_graph: true,
      current_block_height: 800000,
      version: '0.17.0',
    }),
  },
});

const {
  collectHealthData: collectHealthDataLnFail,
  sendHeartbeat: sendHeartbeatLnFail,
} = proxyquire('../monitoring', {
  './ln': {
    getInfo: async () => {
      throw new Error('LND connection refused');
    },
  },
});

describe('Monitoring', () => {
  let sandbox: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('collectHealthData', () => {
    it('should collect health data with Lightning info', async () => {
      // Stub mongoose connection state
      sandbox.stub(mongoose.connection, 'readyState').value(1);

      const data = await collectHealthData('test-bot');

      expect(data.bot).to.equal('test-bot');
      expect(data.timestamp).to.be.a('number');
      expect(data.uptime).to.be.a('number');
      expect(data.processId).to.equal(process.pid);
      expect(data.memory).to.have.property('rss');
      expect(data.memory).to.have.property('heapTotal');
      expect(data.memory).to.have.property('heapUsed');
      expect(data.dbConnected).to.equal(true);
      expect(data.dbState).to.equal('connected');
      expect(data.lightningConnected).to.equal(true);
      expect(data.lightningInfo).to.deep.include({
        alias: 'test-node',
        active_channels_count: 5,
        peers_count: 3,
        synced_to_chain: true,
        synced_to_graph: true,
        block_height: 800000,
      });
    });

    it('should handle Lightning connection failure gracefully', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(1);

      const data = await collectHealthDataLnFail('test-bot');

      expect(data.lightningConnected).to.equal(false);
      expect(data.lastError).to.include('LND connection refused');
      expect(data.lightningInfo).to.be.undefined;
    });

    it('should report correct DB state when disconnected', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(0);

      const data = await collectHealthData('test-bot');

      expect(data.dbConnected).to.equal(false);
      expect(data.dbState).to.equal('disconnected');
    });
  });

  describe('sendHeartbeat', () => {
    it('should POST health data to monitor URL', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(1);
      const postStub = sandbox.stub(axios, 'post').resolves({ status: 200 });

      const config = {
        monitorUrl: 'https://monitor.example.com',
        authToken: 'test-token',
        intervalMs: 120000,
        botName: 'test-bot',
      };

      await sendHeartbeat(config);

      expect(postStub.calledOnce).to.equal(true);
      const [url, body, options] = postStub.firstCall.args as [string, any, any];
      expect(url).to.equal('https://monitor.example.com/api/heartbeat');
      expect(body.bot).to.equal('test-bot');
      expect(body.timestamp).to.be.a('number');
      expect(options.headers['Authorization']).to.equal('Bearer test-token');
      expect(options.timeout).to.equal(10000);
    });

    it('should send without auth header when no token configured', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(1);
      const postStub = sandbox.stub(axios, 'post').resolves({ status: 200 });

      const config = {
        monitorUrl: 'https://monitor.example.com',
        authToken: '',
        intervalMs: 120000,
        botName: 'test-bot',
      };

      await sendHeartbeat(config);

      const [, , options] = postStub.firstCall.args as [string, any, any];
      expect(options.headers).to.not.have.property('Authorization');
    });

    it('should not throw when monitor service is unreachable', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(1);
      sandbox.stub(axios, 'post').rejects(new Error('ECONNREFUSED'));

      const config = {
        monitorUrl: 'https://monitor.example.com',
        authToken: 'test-token',
        intervalMs: 120000,
        botName: 'test-bot',
      };

      // Should not throw
      await sendHeartbeat(config);
    });

    it('should handle HTTP error responses gracefully', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(1);
      const error: any = new Error('Forbidden');
      error.response = { status: 403, data: { error: 'Invalid token' } };
      sandbox.stub(axios, 'post').rejects(error);

      const config = {
        monitorUrl: 'https://monitor.example.com',
        authToken: 'bad-token',
        intervalMs: 120000,
        botName: 'test-bot',
      };

      // Should not throw
      await sendHeartbeat(config);
    });
  });
});

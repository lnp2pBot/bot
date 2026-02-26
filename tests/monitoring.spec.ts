import axios from 'axios';
import mongoose from 'mongoose';

const { expect } = require('chai');
const sinon = require('sinon');

const proxyquire = require('proxyquire').noCallThru();

// Mock Config model
const mockConfigUp = {
  findOne: async () => ({
    node_status: 'up',
    node_uri: 'test-node@127.0.0.1:9735',
    node_alias: 'test-node',
    node_version: '0.17.0',
    node_block_height: 800000,
    node_channels_count: 5,
    node_peers_count: 3,
    node_synced_to_chain: true,
    node_synced_to_graph: true,
  }),
};

const mockConfigDown = {
  findOne: async () => ({
    node_status: 'down',
    node_uri: '',
    node_alias: '',
    node_version: '',
    node_block_height: 0,
    node_channels_count: 0,
    node_peers_count: 0,
    node_synced_to_chain: false,
    node_synced_to_graph: false,
  }),
};

const mockConfigFail = {
  findOne: async () => {
    throw new Error('DB query failed');
  },
};

const { collectHealthData, sendHeartbeat } = proxyquire('../monitoring', {
  './models': { Config: mockConfigUp },
  'node-schedule': { scheduleJob: () => {} },
});

const { collectHealthData: collectHealthDataLnDown } = proxyquire(
  '../monitoring',
  {
    './models': { Config: mockConfigDown },
    'node-schedule': { scheduleJob: () => {} },
  },
);

const { collectHealthData: collectHealthDataLnFail } = proxyquire(
  '../monitoring',
  {
    './models': { Config: mockConfigFail },
    'node-schedule': { scheduleJob: () => {} },
  },
);

describe('Monitoring', () => {
  let sandbox: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('collectHealthData', () => {
    it('should collect health data with Lightning info from Config', async () => {
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
        version: '0.17.0',
        node_uri: 'test-node@127.0.0.1:9735',
      });
    });

    it('should report lightning down when Config node_status is down', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(1);

      const data = await collectHealthDataLnDown('test-bot');

      expect(data.lightningConnected).to.equal(false);
    });

    it('should handle Config query failure gracefully', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(1);

      const data = await collectHealthDataLnFail('test-bot');

      expect(data.lightningConnected).to.equal(false);
      expect(data.lastError).to.include('DB query failed');
      expect(data.lightningInfo).to.equal(undefined);
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

      await sendHeartbeat(
        'https://monitor.example.com',
        'test-token',
        'test-bot',
      );

      expect(postStub.calledOnce).to.equal(true);
      const args = postStub.firstCall.args;
      expect(args[0]).to.equal('https://monitor.example.com/api/heartbeat');
      expect(args[1].bot).to.equal('test-bot');
      expect(args[1].timestamp).to.be.a('number');
      expect(args[2].headers.Authorization).to.equal('Bearer test-token');
      expect(args[2].timeout).to.equal(10000);
    });

    it('should send without auth header when no token configured', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(1);
      const postStub = sandbox.stub(axios, 'post').resolves({ status: 200 });

      await sendHeartbeat('https://monitor.example.com', '', 'test-bot');

      const options = postStub.firstCall.args[2];
      expect(options.headers).to.not.have.property('Authorization');
    });

    it('should not throw when monitor service is unreachable', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(1);
      sandbox.stub(axios, 'post').rejects(new Error('ECONNREFUSED'));

      await sendHeartbeat(
        'https://monitor.example.com',
        'test-token',
        'test-bot',
      );
    });

    it('should handle HTTP error responses gracefully', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(1);
      const error: any = new Error('Forbidden');
      error.response = { status: 403, data: { error: 'Invalid token' } };
      sandbox.stub(axios, 'post').rejects(error);

      await sendHeartbeat(
        'https://monitor.example.com',
        'bad-token',
        'test-bot',
      );
    });
  });
});

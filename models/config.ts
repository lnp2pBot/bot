import mongoose, { Document, Schema } from 'mongoose';

export interface IConfig extends Document {
  maintenance: boolean;
  node_status: string;
  node_uri: string;
  node_alias: string;
  node_version: string;
  node_block_height: number;
  node_channels_count: number;
  node_peers_count: number;
  node_synced_to_chain: boolean;
  node_synced_to_graph: boolean;
}

const configSchema = new Schema<IConfig>({
  maintenance: { type: Boolean, default: false },
  node_status: { type: String, default: 'down' },
  node_uri: { type: String },
  node_alias: { type: String },
  node_version: { type: String },
  node_block_height: { type: Number },
  node_channels_count: { type: Number },
  node_peers_count: { type: Number },
  node_synced_to_chain: { type: Boolean },
  node_synced_to_graph: { type: Boolean },
});

export default mongoose.model<IConfig>('Config', configSchema);

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const app = express();
console.log(path.join(__dirname, 'public'));
app.set('view engine', 'ejs');
app.use('/static', express.static(path.join(__dirname, 'public')))
app.use(express.json());

// Currently we only use one Binance Credential, it should be from users
const API_KEY = process.env.BINANCE_API_KEY!;
const API_SECRET = process.env.BINANCE_API_SECRET!;

function getDummyTicket(ticket: string) {
  const tickets = ['uJklm', 'kkLyu', 'skcku'];
  let index = tickets.indexOf(ticket);
  if (index < 0) {
    index = 0;
  }

  const orderIds = ['10111', '20222', '30333'];
  const symbols = ['BEAMXUSDT', 'AAVEUSDT', 'TURBOUSDT'];
  const metadata = ['1', '2', '3'];

  const orderId = orderIds[index];
  const symbol = symbols[index];
  const meta = metadata[index];

  return { ticket, orderId, symbol, meta };
}

function createSignature(queryString: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
}

app.get('/ticket/:id', async (req: Request, res: Response) => {

  const serverTimeEndpoint = '/fapi/v1/time';
  let servTime = Date.now();

  try {
    const timeResp = await axios.get(`https://fapi.binance.com${serverTimeEndpoint}`);
    servTime = timeResp.data.serverTime;
 
  } catch (error) {
    return res.status(500).json({ error: error });
  }

  let data = getDummyTicket(req.params.id);

  // Query string parameters
  const queryString = `timestamp=${servTime}&symbol=${data.symbol}&orderId=${data.orderId}&recvWindow=60000`;
  const signature = createSignature(queryString, API_SECRET);
  const finalQueryString = `${queryString}&signature=${signature}`;

  return res.status(200).json({
    api_key: API_KEY,
    query_string: finalQueryString,
    metadata: `https://ticketmock.blocknaut.xyz/mockmetadata/metadata${data.meta}.json`
  });

});

const PORT = process.env.PORT || 8181;

// Start server
app.listen(PORT, () => {
  console.log(`App is listening on port ${PORT}`);
});
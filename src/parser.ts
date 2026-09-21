// Conservative parser: ambiguous messages go to review instead of changing expense totals.
import { Balance, Category, Entry, Message } from './model';

const amountToken = '(?:₹|INR\\.?|Rs\\.?)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)(?![0-9,]|\\.[0-9])';
const balancePattern = new RegExp('(?:available|avl|avail|closing|current|clear)?\\.?\\s*(?:bal(?:ance)?)[.:]?\\s*(?:is|of|in your account|:|-)?\\s*' + amountToken, 'ig');
const ignored = /\b(?:otp|one[ -]time password|verification code|upi pin|collect request|payment request|requesting|requested|pending|processing|unsuccessful|failed|declined|scheduled|will be debited|to be debited|autopay reminder|mandate registration)\b/i;
const banks: [string, RegExp][] = [
  ['HDFC', /hdfc/i], ['ICICI', /icici/i], ['SBI', /\bsbi\b|sbiinb|sbiupi|sbitxn|sbiatm|state bank/i], ['Axis', /axis|axisbk/i],
  ['Kotak', /kotak|kotakb/i], ['Canara', /canara|canbnk/i], ['Indian Bank', /indian bank|indbnk/i],
  ['Union Bank', /union bank|unionb/i], ['Bank of Baroda', /baroda|bobtxn|bobupi|bobbnk/i],
  ['PNB', /punjab national|pnb/i], ['IDFC FIRST', /idfc/i], ['Federal', /federal|fedbnk/i],
  ['IDBI', /idbi/i], ['Bank of India', /bank of india|boiind/i], ['Yes Bank', /yes bank|yesbnk/i],
  ['Indian Overseas', /indian overseas|iob/i], ['RBL', /\brbl/i], ['IndusInd', /indusind|indusb/i],
];
export function toPaise(value: string): number { return Math.round(Number(value.replace(/,/g, '')) * 100); }
export function appName(sender: string, body: string) {
  const text = `${sender} ${body}`;
  if (/phonepe/i.test(text)) return 'PhonePe';
  if (/gpay|google pay|com.google.android.apps.nbu.paisa.user/i.test(text)) return 'Google Pay';
  if (/paytm|net.one97.paytm/i.test(text)) return 'Paytm';
  if (/bhim|in.org.npci.upiapp/i.test(text)) return 'BHIM';
  return 'Bank';
}
function category(text: string, credit: boolean): Category {
  if (/petrol|diesel|fuel|shell|hpcl|iocl/i.test(text)) return 'Fuel';
  if (/food|snacks?|cafe|coffee|zomato|swiggy|restaurant|bakery/i.test(text)) return 'Food';
  if (/electric|recharge|airtel|jio|broadband|water bill/i.test(text)) return 'Bills';
  if (/uber|ola|irctc|metro|flight|travel/i.test(text)) return 'Travel';
  if (/hospital|pharmacy|clinic|medical/i.test(text)) return 'Health';
  if (/amazon|flipkart|shopping|mall/i.test(text)) return 'Shopping';
  if (credit && /salary|interest|payroll/i.test(text)) return 'Income';
  if (/upi|imps|neft|transfer/i.test(text)) return 'Transfer';
  return credit ? 'Income' : 'Other';
}
export interface Parsed { entry?: Entry; balance?: Balance; reason?: string }
export function parseMessage(message: Message): Parsed {
  const text = message.body.replace(/\s+/g, ' ').trim();
  if (!text || !Number.isFinite(message.at) || ignored.test(text)) return {};
  // A card limit is not a bank balance. Card statements need a different ledger model.
  if (/credit card|card ending|available credit|credit limit|minimum due|total due|amount due/i.test(text)) return { reason: 'Card/limit message: review separately from bank transactions.' };
  // Sender wins over bank names mentioned in transfers to/from another bank.
  const bank = (banks.find(([, pattern]) => pattern.test(message.sender)) || banks.find(([, pattern]) => pattern.test(text)))?.[0];
  const accountSuffixes = [...new Set([...text.matchAll(/(?:a\s*\/\s*c|ac(?:ct|count)?|acc(?:ount)?)(?:\s*(?:no|number|ending|xx))?[.\s:#-]*[xX*•]*(\d{3,})\b/ig)].map(m => m[1]!.slice(-4)))];
  const account = accountSuffixes.length === 1 ? accountSuffixes[0] : undefined;
  const balanceMatches = [...text.matchAll(balancePattern)];
  let balance: Balance | undefined;
  if (balanceMatches.length === 1 && account && bank && message.source !== 'manual') {
    balance = { id: message.id, bank, account, paise: toPaise(balanceMatches[0]![1]!), at: message.at, source: message.source, raw: text };
    if (!Number.isSafeInteger(balance.paise) || balance.paise < 0) balance = undefined;
  }
  // Strip balances before selecting the transaction amount, even if balance appeared first.
  const transactionText = text.replace(balancePattern, ' ').replace(/(?:available|avl|avail)\.?\s*bal[^.;]*/ig, ' ');
  const amounts = [...transactionText.matchAll(new RegExp(amountToken, 'ig'))];
  const sentToYou = /\bsent (?:you|to you)\b/i.test(transactionText);
  const debit = /\b(?:debited|paid|spent|withdrawn|transferred to)\b/i.test(transactionText) || (/\bsent\b/i.test(transactionText) && !sentToYou);
  const credit = sentToYou || /\b(?:credited|received|deposited|refunded|reversed|transferred from)\b/i.test(transactionText);
  if (debit && credit) return { balance, reason: 'Both debit and credit appear. Confirm the transaction direction.' };
  if (!debit && !credit) return balance ? { balance } : { reason: 'No completed transaction or identifiable bank balance found.' };
  if (amounts.length !== 1) return { balance, reason: 'Could not identify one transaction amount safely.' };
  const paise = toPaise(amounts[0]![1]!);
  if (!Number.isSafeInteger(paise) || paise <= 0) return { balance, reason: 'Invalid transaction amount.' };
  const reference = text.match(/(?:UPI\s*ref(?:erence)?(?:\s*no)?|ref(?:erence)?(?:\s*no)?|UTR|RRN|txn\s*id|transaction\s*id)[.\s:#-]*([a-z\d]{6,})/i)?.[1]?.toUpperCase();
  const merchantRegex = credit ? /\bfrom\s+([a-z][a-z0-9 .&@_-]{1,55}?)(?=\s+(?:on|via|ref|upi|a\/c)|[.;]|$)/i : /\b(?:to|at)\s+([a-z][a-z0-9 .&@_-]{1,55}?)(?=\s+(?:on|via|ref|using|upi)|[.;]|$)/i;
  let merchant = text.match(merchantRegex)?.[1]?.trim();
  if (merchant && /^(?:a\/c|account|acct)\b/i.test(merchant)) merchant = undefined;
  return { balance, entry: { id: message.id, eventIds: [message.id], kind: credit ? 'credit' : 'debit', paise, at: message.at,
    account, bank, app: appName(message.sender, text), reference, merchant: merchant || (credit ? 'Money received' : 'Payment'),
    category: category(text, credit), raw: text, source: message.source } };
}

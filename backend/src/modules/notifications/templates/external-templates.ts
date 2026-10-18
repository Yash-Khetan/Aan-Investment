import { renderEmailLayout } from "./email-layout";

function formatCurrency(amount: number | string): string {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return isNaN(num) ? "0.00" : num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface EmiReminderParams {
    borrowerName: string;
    loanAccountNumber: string;
    amountDue: number | string;
    dueDate: string;
}

export function buildEmiReminder(params: EmiReminderParams) {
    const formattedAmount = formatCurrency(params.amountDue);
    const whatsappText =
        `*Payment Reminder - Aan Finance*\n\n` +
        `Dear ${params.borrowerName},\n` +
        `This is a reminder that your scheduled installment of *₹${formattedAmount}* for Loan account *#${params.loanAccountNumber}* is due on *${params.dueDate}*.\n\n` +
        `Please ensure timely clearance to avoid penal charges and maintain a clean credit score.\n\n` +
        `For assistance, reply to this message or contact your branch.`;

    const emailSubject = `Payment Reminder: Installment due on ${params.dueDate} (Loan #${params.loanAccountNumber})`;

    const emailHtml = renderEmailLayout({
        previewText: `Your EMI of ₹${formattedAmount} is due on ${params.dueDate}`,
        bodyHtml:
            `<h2 style="margin:0 0 16px;font-size:18px;color:#1a3c6e;">Installment Payment Reminder</h2>` +
            `<p style="margin:0 0 12px;">Dear <strong>${params.borrowerName}</strong>,</p>` +
            `<p style="margin:0 0 12px;">This is a reminder regarding your upcoming loan installment with Aan Finance:</p>` +
            `<table style="width:100%;margin:16px 0;border-collapse:collapse;">` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Loan Account:</td><td style="padding:8px 0;font-weight:bold;text-align:right;">#${params.loanAccountNumber}</td></tr>` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Amount Due:</td><td style="padding:8px 0;font-weight:bold;color:#1a3c6e;text-align:right;">₹${formattedAmount}</td></tr>` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Due Date:</td><td style="padding:8px 0;font-weight:bold;text-align:right;">${params.dueDate}</td></tr>` +
            `</table>` +
            `<p style="margin:12px 0;color:#4b5563;">Please ensure sufficient funds in your bank account or execute payment via your registered payment channel to avoid penal interest charges.</p>`,
    });

    return { whatsappText, emailSubject, emailHtml };
}

export interface OverdueNoticeParams {
    borrowerName: string;
    loanAccountNumber: string;
    overdueAmount: number | string;
    dpd: number;
}

export function buildOverdueNotice(params: OverdueNoticeParams) {
    const formattedAmount = formatCurrency(params.overdueAmount);
    const whatsappText =
        `⚠️ *URGENT: Overdue Payment Notice - Aan Finance*\n\n` +
        `Dear ${params.borrowerName},\n` +
        `Your Loan account *#${params.loanAccountNumber}* is currently overdue by *${params.dpd} day(s)* with an unpaid balance of *₹${formattedAmount}*.\n\n` +
        `Penal charges and interest are being accrued on your overdue balance. Please clear this immediately to prevent adverse reporting to CIBIL and further recovery action.\n\n` +
        `Contact your branch or relationship manager immediately.`;

    const emailSubject = `URGENT: Overdue Payment Notice for Loan #${params.loanAccountNumber} (${params.dpd} Days Overdue)`;

    const emailHtml = renderEmailLayout({
        previewText: `Action Required: ₹${formattedAmount} overdue on Loan #${params.loanAccountNumber}`,
        bodyHtml:
            `<h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Demand Notice - Immediate Payment Required</h2>` +
            `<p style="margin:0 0 12px;">Dear <strong>${params.borrowerName}</strong>,</p>` +
            `<p style="margin:0 0 12px;">Our records show that your loan account is currently in default:</p>` +
            `<table style="width:100%;margin:16px 0;border-collapse:collapse;">` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Loan Account:</td><td style="padding:8px 0;font-weight:bold;text-align:right;">#${params.loanAccountNumber}</td></tr>` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Total Overdue Amount:</td><td style="padding:8px 0;font-weight:bold;color:#dc2626;text-align:right;">₹${formattedAmount}</td></tr>` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Days Past Due (DPD):</td><td style="padding:8px 0;font-weight:bold;text-align:right;">${params.dpd} day(s)</td></tr>` +
            `</table>` +
            `<p style="margin:12px 0;color:#dc2626;font-weight:500;">Continued non-payment will result in escalation, additional penal interest, and reporting to credit rating bureaus.</p>` +
            `<p style="margin:0;color:#4b5563;">Please deposit the overdue balance immediately.</p>`,
    });

    return { whatsappText, emailSubject, emailHtml };
}

export interface DisbursementNoticeParams {
    borrowerName: string;
    loanAccountNumber: string;
    sanctionedAmount: number | string;
    disbursedAmount: number | string;
    tenureMonths?: number;
    interestRate?: number | string;
}

export function buildDisbursementNotice(params: DisbursementNoticeParams) {
    const formattedSanctioned = formatCurrency(params.sanctionedAmount);
    const formattedDisbursed = formatCurrency(params.disbursedAmount);

    const whatsappText =
        `🎉 *Loan Disbursement Confirmation - Aan Finance*\n\n` +
        `Dear ${params.borrowerName},\n` +
        `We are pleased to inform you that your loan has been disbursed successfully!\n\n` +
        `*Loan Account:* #${params.loanAccountNumber}\n` +
        `*Sanctioned Amount:* ₹${formattedSanctioned}\n` +
        `*Net Disbursed:* ₹${formattedDisbursed}\n` +
        (params.tenureMonths ? `*Tenure:* ${params.tenureMonths} Months\n` : "") +
        (params.interestRate ? `*Interest Rate:* ${params.interestRate}% p.a.\n\n` : "\n") +
        `Thank you for placing your trust in Aan Finance.`;

    const emailSubject = `Loan Disbursed Successfully: #${params.loanAccountNumber}`;

    const emailHtml = renderEmailLayout({
        previewText: `Your loan #${params.loanAccountNumber} has been disbursed`,
        bodyHtml:
            `<h2 style="margin:0 0 16px;font-size:18px;color:#16a34a;">Loan Disbursement Confirmed</h2>` +
            `<p style="margin:0 0 12px;">Dear <strong>${params.borrowerName}</strong>,</p>` +
            `<p style="margin:0 0 12px;">Congratulations! Your loan facility with Aan Finance is now active:</p>` +
            `<table style="width:100%;margin:16px 0;border-collapse:collapse;">` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Loan Account Number:</td><td style="padding:8px 0;font-weight:bold;text-align:right;">#${params.loanAccountNumber}</td></tr>` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Sanctioned Facility:</td><td style="padding:8px 0;font-weight:bold;text-align:right;">₹${formattedSanctioned}</td></tr>` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Net Disbursed:</td><td style="padding:8px 0;font-weight:bold;color:#16a34a;text-align:right;">₹${formattedDisbursed}</td></tr>` +
            (params.tenureMonths ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Tenure:</td><td style="padding:8px 0;text-align:right;">${params.tenureMonths} Months</td></tr>` : "") +
            `</table>` +
            `<p style="margin:12px 0;color:#4b5563;">Thank you for partnering with Aan Finance.</p>`,
    });

    return { whatsappText, emailSubject, emailHtml };
}

export interface PaymentReceiptParams {
    borrowerName: string;
    loanAccountNumber: string;
    amountPaid: number | string;
    paymentDate: string;
    outstandingBalance: number | string;
    receiptNumber?: string;
}

export function buildPaymentReceipt(params: PaymentReceiptParams) {
    const formattedPaid = formatCurrency(params.amountPaid);
    const formattedBalance = formatCurrency(params.outstandingBalance);

    const whatsappText =
        `✅ *Payment Received - Aan Finance*\n\n` +
        `Dear ${params.borrowerName},\n` +
        `We have received your payment of *₹${formattedPaid}* on *${params.paymentDate}* towards Loan account *#${params.loanAccountNumber}*.\n\n` +
        `*Current Outstanding Balance:* ₹${formattedBalance}\n` +
        (params.receiptNumber ? `*Ref / Receipt:* ${params.receiptNumber}\n\n` : "\n") +
        `Thank you for your timely payment!`;

    const emailSubject = `Payment Receipt: ₹${formattedPaid} credited for Loan #${params.loanAccountNumber}`;

    const emailHtml = renderEmailLayout({
        previewText: `Payment receipt for ₹${formattedPaid} on Loan #${params.loanAccountNumber}`,
        bodyHtml:
            `<h2 style="margin:0 0 16px;font-size:18px;color:#16a34a;">Payment Receipt Acknowledgment</h2>` +
            `<p style="margin:0 0 12px;">Dear <strong>${params.borrowerName}</strong>,</p>` +
            `<p style="margin:0 0 12px;">We gratefully acknowledge receipt of your payment:</p>` +
            `<table style="width:100%;margin:16px 0;border-collapse:collapse;">` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Loan Account:</td><td style="padding:8px 0;font-weight:bold;text-align:right;">#${params.loanAccountNumber}</td></tr>` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Amount Credited:</td><td style="padding:8px 0;font-weight:bold;color:#16a34a;text-align:right;">₹${formattedPaid}</td></tr>` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Date Received:</td><td style="padding:8px 0;text-align:right;">${params.paymentDate}</td></tr>` +
            `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Remaining Outstanding:</td><td style="padding:8px 0;font-weight:bold;text-align:right;">₹${formattedBalance}</td></tr>` +
            (params.receiptNumber ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;">Reference / Receipt #:</td><td style="padding:8px 0;text-align:right;">${params.receiptNumber}</td></tr>` : "") +
            `</table>` +
            `<p style="margin:12px 0;color:#4b5563;">Your loan ledger has been updated accordingly.</p>`,
    });

    return { whatsappText, emailSubject, emailHtml };
}

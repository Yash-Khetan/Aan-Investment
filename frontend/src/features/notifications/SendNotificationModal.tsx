import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { sendManualNotification, getBorrowerRecentNotification } from "./api";
import { apiRequest } from "../../lib/api";

interface BorrowerOption {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  borrowerCode?: string;
}

interface SendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedBorrowerId?: string;
}

/**
 * Normalises an Indian phone number to E.164 (+91XXXXXXXXXX).
 *
 * Accepts:
 *   - Already-formatted E.164:  +91XXXXXXXXXX  → returns as-is
 *   - 10-digit bare number:      9876543210     → +919876543210
 *   - 11-digit with leading 0:   09876543210    → +919876543210
 *   - Country code without +:    919876543210   → +919876543210
 *
 * Returns null when the number cannot be made into a valid 10-digit Indian number.
 */
function normalizeIndianPhone(raw: string): string | null {
  // Strip spaces, dashes, dots and parentheses commonly added for readability
  const cleaned = raw.replace(/[\s\-().]/g, "");

  // Already correct E.164 with +91
  if (/^\+91\d{10}$/.test(cleaned)) return cleaned;

  // +91 present but wrong digit count → invalid
  if (cleaned.startsWith("+91")) {
    const digits = cleaned.slice(3);
    return digits.length === 10 ? `+91${digits}` : null;
  }

  // Country code without the plus: 91XXXXXXXXXX (12 digits total)
  if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`;

  // Leading STD zero: 0XXXXXXXXXX (11 digits)
  if (/^0\d{10}$/.test(cleaned)) return `+91${cleaned.slice(1)}`;

  // Bare 10-digit number
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;

  return null;
}

export function SendNotificationModal({
  isOpen,
  onClose,
  preselectedBorrowerId,
}: SendNotificationModalProps) {
  const queryClient = useQueryClient();

  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [borrowerId, setBorrowerId] = useState<string>(preselectedBorrowerId || "");
  const [recipient, setRecipient] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [template, setTemplate] = useState<string>("CUSTOM");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch borrowers for dropdown
  const { data: borrowers } = useQuery({
    queryKey: ["borrowers-list-for-notifications"],
    queryFn: async () => {
      const res = await apiRequest<{ data: BorrowerOption[] }>("/api/v1/borrowers");
      return res.data || [];
    },
    enabled: isOpen,
  });

  // Check recent notification for the selected borrower (multi-admin race warning)
  const { data: recentNotice } = useQuery({
    queryKey: ["recent-notification", borrowerId],
    queryFn: () => getBorrowerRecentNotification(borrowerId),
    enabled: !!borrowerId && isOpen,
  });

  // Validate a WhatsApp recipient phone number and update error state
  const validatePhone = useCallback((value: string) => {
    if (channel !== "WHATSAPP" || !value) {
      setPhoneError(null);
      return;
    }
    const normalised = normalizeIndianPhone(value);
    if (!normalised) {
      setPhoneError("Enter a valid 10-digit Indian mobile number (e.g. 9876543210 or +919876543210)");
    } else {
      setPhoneError(null);
    }
  }, [channel]);

  // When borrower changes, auto-fill and normalise the recipient phone/email
  useEffect(() => {
    if (!borrowerId || !borrowers) return;
    const selected = borrowers.find((b) => b.id === borrowerId);
    if (selected) {
      if (channel === "WHATSAPP") {
        const raw = selected.phone || "";
        const normalised = raw ? (normalizeIndianPhone(raw) ?? raw) : "";
        setRecipient(normalised);
        // Validate the auto-filled value immediately
        if (raw && !normalizeIndianPhone(raw)) {
          setPhoneError(`Stored number "${raw}" is not a valid 10-digit Indian mobile — please correct it.`);
        } else {
          setPhoneError(null);
        }
      } else {
        setRecipient(selected.email || "");
        setPhoneError(null);
      }
    }
  }, [borrowerId, channel, borrowers]);

  // Handle template selection
  function handleTemplateChange(tpl: string) {
    setTemplate(tpl);
    const selected = borrowers?.find((b) => b.id === borrowerId);
    const name = selected ? selected.name : "[Borrower Name]";

    if (tpl === "EMI_REMINDER") {
      setSubject("Payment Reminder - Installment Due");
      setMessage(
        `Dear ${name},\n\nThis is a reminder from Aan Finance that your scheduled installment of ₹[Amount] is due on [Date].\n\nPlease ensure timely payment to maintain a good credit score and avoid penal interest.\n\nThank you.`
      );
    } else if (tpl === "OVERDUE_NOTICE") {
      setSubject("URGENT: Overdue Payment Notice - Aan Finance");
      setMessage(
        `URGENT NOTICE:\n\nDear ${name},\nYour loan account is currently overdue with an outstanding balance of ₹[Amount].\n\nPenal charges have accrued. Please deposit the overdue amount immediately to prevent adverse CIBIL reporting and recovery escalation.\n\n- Aan Finance Collections Desk`
      );
    } else if (tpl === "PAYMENT_RECEIPT") {
      setSubject("Payment Receipt - Aan Finance");
      setMessage(
        `Dear ${name},\n\nWe have received your payment of ₹[Amount] on [Date]. Your updated outstanding balance is ₹[Balance].\n\nThank you for your prompt payment!\n- Aan Finance`
      );
    } else if (tpl === "DISBURSEMENT") {
      setSubject("Loan Facility Disbursed - Aan Finance");
      setMessage(
        `Dear ${name},\n\nCongratulations! Your loan has been disbursed successfully. Sanctioned amount: ₹[Amount]. Net disbursed: ₹[Net].\n\nThank you for partnering with Aan Finance.`
      );
    }
  }

  const mutation = useMutation({
    mutationFn: sendManualNotification,
    onSuccess: (data) => {
      setSuccessMessage(data.message || "Notification sent successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "notification-stats"] });
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    },
  });

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipient || !message) return;

    // For WhatsApp: normalise the number one final time before sending
    let finalRecipient = recipient;
    if (channel === "WHATSAPP") {
      const normalised = normalizeIndianPhone(recipient);
      if (!normalised) {
        setPhoneError("Enter a valid 10-digit Indian mobile number before sending.");
        return;
      }
      finalRecipient = normalised;
      setRecipient(normalised); // update the field to show the normalised value
    }

    mutation.mutate({
      borrowerId: borrowerId || undefined,
      channel,
      recipient: finalRecipient,
      subject: channel === "EMAIL" ? subject : undefined,
      message,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Send Notification</h2>
            <p className="text-xs text-slate-500">Dispatch external WhatsApp or Email notification to borrower</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {successMessage && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-800 border border-emerald-200">
              ✓ {successMessage}
            </div>
          )}

          {mutation.isError && (
            <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-800 border border-rose-200">
              {(mutation.error as any)?.message || "Failed to dispatch notification"}
            </div>
          )}

          {/* Channel Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Communication Channel
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChannel("WHATSAPP")}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                  channel === "WHATSAPP"
                    ? "border-emerald-500 bg-emerald-50/50 text-emerald-700 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-lg">💬</span> WhatsApp (Twilio)
              </button>
              <button
                type="button"
                onClick={() => setChannel("EMAIL")}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                  channel === "EMAIL"
                    ? "border-blue-500 bg-blue-50/50 text-blue-700 ring-2 ring-blue-500/20"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-lg">✉️</span> Email (SMTP)
              </button>
            </div>
          </div>

          {/* Borrower Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Select Borrower (Optional)
            </label>
            <select
              value={borrowerId}
              onChange={(e) => setBorrowerId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
            >
              <option value="">-- Choose Borrower or enter contact manually --</option>
              {borrowers?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.phone || "No phone"} | {b.email || "No email"})
                </option>
              ))}
            </select>
          </div>

          {/* Race Condition / Recent Notification Warning Banner */}
          {recentNotice && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="font-semibold flex items-center gap-1.5">
                <span>⚠️</span> Notice Already Sent Recently:
              </div>
              <p className="mt-1">
                A <strong>{recentNotice.channel}</strong> notification (<em>{recentNotice.title}</em>) was sent to this
                borrower on {new Date(recentNotice.createdAt).toLocaleString()}. Please confirm before sending another.
              </p>
            </div>
          )}

          {/* Recipient Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Recipient {channel === "WHATSAPP" ? "Phone Number" : "Email Address"} *
            </label>
            <input
              type={channel === "WHATSAPP" ? "tel" : "email"}
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                validatePhone(e.target.value);
              }}
              onBlur={(e) => {
                // On blur: attempt normalisation and update the field silently
                if (channel === "WHATSAPP" && e.target.value) {
                  const normalised = normalizeIndianPhone(e.target.value);
                  if (normalised) {
                    setRecipient(normalised);
                    setPhoneError(null);
                  } else {
                    validatePhone(e.target.value);
                  }
                }
              }}
              placeholder={channel === "WHATSAPP" ? "9876543210 or +919876543210" : "borrower@example.com"}
              required
              className={`w-full rounded-md border px-3 py-2 text-sm text-slate-800 focus:outline-none font-mono ${
                phoneError
                  ? "border-rose-400 focus:border-rose-500 bg-rose-50"
                  : "border-slate-300 focus:border-slate-500"
              }`}
            />
            {channel === "WHATSAPP" && !phoneError && (
              <p className="mt-1 text-[11px] text-slate-400">
                Enter 10-digit number — +91 will be added automatically if missing.
              </p>
            )}
            {phoneError && (
              <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
                <span>⚠</span> {phoneError}
              </p>
            )}
          </div>

          {/* Email Subject (Only for Email) */}
          {channel === "EMAIL" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Subject *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Important Notice regarding your Loan"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
              />
            </div>
          )}

          {/* Template Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Template Preset
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "CUSTOM", label: "Custom Message" },
                { id: "EMI_REMINDER", label: "EMI Due Reminder" },
                { id: "OVERDUE_NOTICE", label: "Overdue Notice" },
                { id: "PAYMENT_RECEIPT", label: "Payment Receipt" },
                { id: "DISBURSEMENT", label: "Disbursement Welcome" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTemplateChange(t.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    template === t.id
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Body */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Message Content *
            </label>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              placeholder="Type your message here..."
              className="w-full rounded-md border border-slate-300 p-3 text-sm text-slate-800 focus:border-slate-500 focus:outline-none font-sans"
            />
          </div>

          {/* Live Preview Card */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Preview ({channel === "WHATSAPP" ? "WhatsApp Message" : "Email Message"})
            </div>
            {channel === "WHATSAPP" ? (
              <div className="rounded-lg bg-emerald-100/70 p-3 text-xs text-slate-800 shadow-sm max-w-md whitespace-pre-wrap font-sans border border-emerald-200">
                {message || "Message preview will appear here..."}
              </div>
            ) : (
              <div className="rounded-lg bg-white p-3 text-xs text-slate-800 shadow-sm border border-slate-200">
                <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 mb-2">
                  Subject: {subject || "(No subject)"}
                </div>
                <div className="whitespace-pre-wrap text-slate-700">{message || "Body preview..."}</div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !recipient || !message || (channel === "WHATSAPP" && !!phoneError)}
              className={channel === "WHATSAPP" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
            >
              {mutation.isPending
                ? "Sending..."
                : channel === "WHATSAPP"
                ? "Send WhatsApp Message"
                : "Send Email"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

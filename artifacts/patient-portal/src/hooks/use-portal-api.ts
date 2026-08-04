import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { 
  DashboardData, PatientProfile, Appointment, LabResult, LabResultDetail,
  ImagingResult, ImagingDetail, Prescription, Document, Invoice, Payment,
  InsurancePolicy, InsuranceClaim, Hospitalization, Notification, Message,
  Consent, Session, AppointmentRequest
} from "@/lib/types";

// Auth is mostly handled by AuthContext, but let's put these here if needed
export const useGetDashboard = () => useQuery({
  queryKey: ["dashboard"],
  queryFn: () => api.get<DashboardData>("/dashboard"),
});

export const useGetProfile = () => useQuery({
  queryKey: ["profile"],
  queryFn: () => api.get<{ profile: PatientProfile }>("/profile"),
});

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PatientProfile>) => api.patch<{ profile: PatientProfile }>("/profile", data),
    onSuccess: (data) => {
      qc.setQueryData(["profile"], data);
    }
  });
};

export const useGetAppointments = (filter?: string) => useQuery({
  queryKey: ["appointments", filter],
  queryFn: () => api.get<{ appointments: Appointment[] }>(`/appointments${filter ? `?filter=${filter}` : ''}`),
});

export const useCancelAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/appointments/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
};

export const useGetAppointmentRequests = () => useQuery({
  queryKey: ["appointment-requests"],
  queryFn: () => api.get<{ requests: AppointmentRequest[] }>("/appointment-requests"),
});

export const useCreateAppointmentRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post("/appointment-requests", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment-requests"] })
  });
};

export const useCancelAppointmentRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/appointment-requests/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment-requests"] })
  });
};

export const useGetLabResults = () => useQuery({
  queryKey: ["lab-results"],
  queryFn: () => api.get<{ labResults: LabResult[] }>("/lab-results"),
});

export const useGetLabResult = (id: string) => useQuery({
  queryKey: ["lab-results", id],
  queryFn: () => api.get<{ labResult: LabResultDetail }>(`/lab-results/${id}`),
  enabled: !!id,
});

export const useGetImaging = () => useQuery({
  queryKey: ["imaging"],
  queryFn: () => api.get<{ imagingResults: ImagingResult[] }>("/imaging"),
});

export const useGetImagingDetail = (id: string) => useQuery({
  queryKey: ["imaging", id],
  queryFn: () => api.get<{ imagingResult: ImagingDetail }>(`/imaging/${id}`),
  enabled: !!id,
});

export const useGetPrescriptions = () => useQuery({
  queryKey: ["prescriptions"],
  queryFn: () => api.get<{ prescriptions: Prescription[] }>("/prescriptions"),
});

export const useGetPrescription = (id: string) => useQuery({
  queryKey: ["prescriptions", id],
  queryFn: () => api.get<{ prescription: Prescription }>(`/prescriptions/${id}`),
  enabled: !!id,
});

export const useGetDocuments = (category?: string) => useQuery({
  queryKey: ["documents", category],
  queryFn: () => api.get<{ documents: Document[] }>(`/documents${category ? `?category=${category}` : ''}`),
});

export const useGetDocument = (id: string) => useQuery({
  queryKey: ["documents", id],
  queryFn: () => api.get<{ document: Document }>(`/documents/${id}`),
  enabled: !!id,
});

export const useGetInvoices = () => useQuery({
  queryKey: ["invoices"],
  queryFn: () => api.get<{ invoices: Invoice[], totalDue: string, totalPaid: string }>("/invoices"),
});

export const useGetInvoice = (id: string) => useQuery({
  queryKey: ["invoices", id],
  queryFn: () => api.get<{ invoice: Invoice }>(`/invoices/${id}`),
  enabled: !!id,
});

export const useGetPayments = () => useQuery({
  queryKey: ["payments"],
  queryFn: () => api.get<{ payments: Payment[] }>("/payments"),
});

export const useGetInsurance = () => useQuery({
  queryKey: ["insurance"],
  queryFn: () => api.get<{ insurance: InsurancePolicy, allPolicies: InsurancePolicy[], claims: InsuranceClaim[], claimSummary: any }>("/insurance"),
});

export const useGetHospitalizations = () => useQuery({
  queryKey: ["hospitalizations"],
  queryFn: () => api.get<{ hospitalizations: Hospitalization[] }>("/hospitalizations"),
});

export const useGetNotifications = (unreadOnly = false) => useQuery({
  queryKey: ["notifications", unreadOnly],
  queryFn: () => api.get<{ notifications: Notification[] }>(`/notifications?unreadOnly=${unreadOnly}`),
});

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
};

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
};

export const useGetMessages = () => useQuery({
  queryKey: ["messages"],
  queryFn: () => api.get<{ messages: Message[] }>("/messages"),
});

export const useGetMessage = (id: string) => useQuery({
  queryKey: ["messages", id],
  queryFn: () => api.get<{ message: Message }>(`/messages/${id}`),
  enabled: !!id,
});

export const useSendMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: string, subject: string, body: string }) => api.post("/messages", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] })
  });
};

export const useCloseMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/messages/${id}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] })
  });
};

export const useGetConsents = () => useQuery({
  queryKey: ["consents"],
  queryFn: () => api.get<{ consents: Consent[] }>("/consents"),
});

export const useSignConsent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/consents/${id}/sign`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consents"] })
  });
};

export const useRefuseConsent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/consents/${id}/refuse`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consents"] })
  });
};

export const useGetSessions = () => useQuery({
  queryKey: ["sessions"],
  queryFn: () => api.get<{ sessions: Session[] }>("/sessions"),
});

export const useRevokeSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] })
  });
};

export const useGetActivityLog = () => useQuery({
  queryKey: ["activity-log"],
  queryFn: () => api.get<{ logs: any[] }>("/privacy/activity-log"),
});

export const useChangePassword = () => useMutation({
  mutationFn: (data: any) => api.post("/privacy/change-password", data),
});

export const useRequestDataExport = () => useMutation({
  mutationFn: () => api.post("/privacy/request-data-export"),
});

export const useRequestCorrection = () => useMutation({
  mutationFn: (data: any) => api.post("/privacy/request-correction", data),
});

export const useRequestAccountClosure = () => useMutation({
  mutationFn: (data: any) => api.post("/privacy/request-account-closure", data),
});

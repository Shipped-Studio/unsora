"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuthFetch } from "../use-auth-fetch";

export interface TemplateApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SubtitleTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  styleType: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fontSize: number;
  animationType: string;
  textColor?: string;
  activeTextColor?: string;
  activeWordBackgroundColor?: string;
  tags: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  styleType: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fontSize: number;
  animationType: string;
  textColor?: string;
  activeTextColor?: string;
  activeWordBackgroundColor?: string;
  tags?: string[];
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

export const useTemplateApi = () => {
  const { authFetch } = useAuthFetch();
  const [isLoading, setIsLoading] = useState(false);

  const getTemplates = async (): Promise<
    TemplateApiResponse<{ templates: SubtitleTemplate[] }>
  > => {
    setIsLoading(true);
    try {
      const response = await authFetch("/api/templates");
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Get templates error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get templates",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const createTemplate = async (
    template: CreateTemplateRequest
  ): Promise<TemplateApiResponse<{ template: SubtitleTemplate }>> => {
    setIsLoading(true);
    try {
      const response = await authFetch("/api/templates", {
        method: "POST",
        body: JSON.stringify(template),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Create template error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create template",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const updateTemplate = async (
    id: string,
    updates: UpdateTemplateRequest
  ): Promise<TemplateApiResponse<{ template: SubtitleTemplate }>> => {
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Update template error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update template",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTemplate = async (id: string): Promise<TemplateApiResponse> => {
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/templates/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Delete template error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete template",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const getTemplate = async (
    id: string
  ): Promise<TemplateApiResponse<{ template: SubtitleTemplate }>> => {
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/templates/${id}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Get template error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get template",
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
  };
};

import type { Request, Response } from "express";
import { CollectionsService } from "../services/collections.service";
import { mapErrorToHttpResponse } from "../utils/http-error-mapper";
import type {
    CreateActivityInput,
    UpdateActivityInput,
    UpdateStatusInput,
    UpdateFollowUpInput,
    CreatePromiseToPayInput,
    ClosePromiseToPayInput,
} from "../types/collections.types";

export async function createActivity(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as CreateActivityInput;
        const activity = await CollectionsService.createActivity(input);
        res.status(201).json(activity);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function updateActivity(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as UpdateActivityInput;
        const activity = await CollectionsService.updateActivity(String(req.params.id), input);
        res.status(200).json(activity);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function deleteActivity(req: Request, res: Response): Promise<void> {
    try {
        await CollectionsService.deleteActivity(String(req.params.id));
        res.status(204).send();
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function getActivityById(req: Request, res: Response): Promise<void> {
    try {
        const activity = await CollectionsService.getActivity(String(req.params.id));
        res.status(200).json(activity);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function getLoanActivities(req: Request, res: Response): Promise<void> {
    try {
        const activities = await CollectionsService.getLoanActivities(String(req.params.loanId));
        res.status(200).json(activities);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function getCustomerActivities(req: Request, res: Response): Promise<void> {
    try {
        const activities = await CollectionsService.getCustomerActivities(String(req.params.customerId));
        res.status(200).json(activities);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as UpdateStatusInput;
        const activity = await CollectionsService.updateStatus(String(req.params.id), input);
        res.status(200).json(activity);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function updateFollowUp(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as UpdateFollowUpInput;
        const activity = await CollectionsService.updateFollowUp(String(req.params.id), input);
        res.status(200).json(activity);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function createPromiseToPay(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as CreatePromiseToPayInput;
        const activity = await CollectionsService.createPromiseToPay(String(req.params.id), input);
        res.status(201).json(activity);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

export async function closePromiseToPay(req: Request, res: Response): Promise<void> {
    try {
        const input = req.body as ClosePromiseToPayInput;
        const activity = await CollectionsService.closePromiseToPay(String(req.params.id), input);
        res.status(200).json(activity);
    } catch (error) {
        mapErrorToHttpResponse(res, error);
    }
}

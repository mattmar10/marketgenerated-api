import { NextFunction, Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpGet,
  next,
  request,
  requestParam,
  response,
} from "inversify-express-utils";
import TYPES from "../../types";

import { SearchService } from "../../services/search/search_service";

@controller("/search")
export class SearchController {
  constructor(@inject(TYPES.SearchService) private searchSvc: SearchService) {}

  @httpGet("/:query")
  public searchSymbol(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
    @requestParam("query") query: string
  ) {
    const trimmed = query.trim().toLocaleLowerCase();

    if (!trimmed || trimmed.length == 0) {
      res.status(400).send();
    } else {
      const returnResponse = this.searchSvc.basicSearch(trimmed);
      res.json(returnResponse);
    }
  }
}

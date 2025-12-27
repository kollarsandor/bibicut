import os
from langchain_openai import ChatOpenAI
from config import CEREBRAS_API_KEY

class CerebrasLLM:
    def __init__(self, model="qwen-3-32b"):
        self.llm = ChatOpenAI(
            model=model,
            api_key=CEREBRAS_API_KEY,
            base_url="https://api.cerebras.ai/v1",
            default_headers={"X-Cerebras-3rd-Party-Integration": "browser-use"}
        )
        self.model = model
        self.model_name = model
        self.provider = "cerebras"
    
    async def ainvoke(self, *args, **kwargs):
        return await self.llm.ainvoke(*args, **kwargs)
    
    def invoke(self, *args, **kwargs):
        return self.llm.invoke(*args, **kwargs)

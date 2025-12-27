import os
from langchain_openai import ChatOpenAI
from config import CEREBRAS_API_KEY

class CerebrasLLM:
    def __init__(self, model: str = "qwen-3-32b"):
        if not CEREBRAS_API_KEY:
            raise ValueError(
                "CEREBRAS_API_KEY nincs beállítva! "
                "Állítsd be a .env fájlban vagy környezeti változóként."
            )
        
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
    
    def bind_tools(self, *args, **kwargs):
        return self.llm.bind_tools(*args, **kwargs)
    
    def with_structured_output(self, *args, **kwargs):
        return self.llm.with_structured_output(*args, **kwargs)

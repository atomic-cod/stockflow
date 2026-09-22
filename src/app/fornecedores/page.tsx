import { CadastroList } from "@/components/cadastro-list";
export default function Fornecedores(){return <CadastroList entity="fornecedores" title="Fornecedores" description="Gerencie seus fornecedores." fields={[{key:"name",label:"Nome"},{key:"document",label:"Documento"},{key:"email",label:"E-mail",type:"email"},{key:"phone",label:"Telefone"},{key:"address",label:"Endereço"}]}/>;}
